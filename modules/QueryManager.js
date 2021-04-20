const InfoQuery = require("./info/InfoQuery");
const Video = require("./types/Video");
const Utils = require("./Utils");
const InfoQueryList = require("./info/InfoQueryList");
const ProgressBar = require("./types/ProgressBar");
const DownloadQuery = require("./download/DownloadQuery");
const { shell, dialog } = require('electron');
const axios = require('axios')
const path = require('path')
const url = require('url');
const fs = require("fs");
const SizeQuery = require("./size/SizeQuery");
const DownloadQueryList = require("./download/DownloadQueryList");
const Format = require("./types/Format");

class QueryManager {
    constructor(window, environment) {
        this.window = window;
        this.environment = environment;
        this.managedVideos = [];
    }

    async manage(url) {
        let metadataVideo = new Video(url, "metadata", this.environment);
        this.addVideo(metadataVideo);
        const initialQuery = await new InfoQuery(url, metadataVideo.identifier, this.environment).connect();
        if(metadataVideo.error) return;
        if(Utils.isYouTubeChannel(url)) {
            const actualQuery = await new InfoQuery(initialQuery.entries[0].url, metadataVideo.identifier, this.environment).connect();
            if(metadataVideo.error) return;
            this.removeVideo(metadataVideo);
            if(actualQuery.entries == null || actualQuery.entries.length === 0) this.managePlaylist(initialQuery, url);
            else this.managePlaylist(actualQuery, initialQuery.entries[0].url);
            return;
        }

        switch(Utils.detectInfoType(initialQuery)) {
            case "single":
                this.manageSingle(initialQuery, url);
                this.removeVideo(metadataVideo);
                break;
            case "playlist":
                this.managePlaylist(initialQuery, url);
                this.removeVideo(metadataVideo);
                break;
            case "livestream":
                this.environment.errorHandler.raiseError({code: "Not supported", description: "Livestreams are not yet supported."}, metadataVideo.identifier);
                break;
            case false:
                this.environment.errorHandler.checkError("YouTube-dl returned an empty object", metadataVideo.identifier);
                break;
        }
    }

    manageSingle(initialQuery, url) {
        let video = new Video(url, "single", this.environment);
        video.setMetadata(initialQuery);
        this.addVideo(video);
        setTimeout(() => this.updateGlobalButtons(), 700); //This feels kinda hacky, maybe find a better way sometime.
    }

    managePlaylist(initialQuery, url) {
        let playlistVideo = new Video(url, "playlist", this.environment);
        this.addVideo(playlistVideo);
        const playlistQuery = new InfoQueryList(initialQuery, this.environment, new ProgressBar(this, playlistVideo));
        playlistQuery.start().then((videos) => {
            if(videos.length > this.environment.settings.splitMode) {
                let totalFormats = [];
                playlistVideo.videos = videos;
                for(const video of videos) {
                    for(const format of video.formats) {
                        format.display_name = Format.getDisplayName(format.height, format.fps);
                        totalFormats.push(format);
                    }
                }
                //Dedupe totalFormats by height and fps
                totalFormats = totalFormats.filter((v,i,a) => a.findIndex(t=>(t.height === v.height && t.fps === v.fps))===i);
                //Sort totalFormats DESC by height and fps
                totalFormats.sort((a, b) => b.height - a.height || b.fps - a.fps);
                const title = initialQuery.title == null ? url : initialQuery.title;
                const uploader = initialQuery.uploader == null ? "Unknown" : initialQuery.uploader;
                this.window.webContents.send("videoAction", {action: "setUnified", identifier: playlistVideo.identifier,formats: totalFormats, subtitles: playlistVideo.downloadSubs, thumb: videos[0].thumbnail, title: title, length: videos.length, uploader: uploader})
            } else {
                this.removeVideo(playlistVideo);
                for (const video of videos) {
                    this.addVideo(video);
                }
            }
            setTimeout(() => this.updateGlobalButtons(), 700); //This feels kinda hacky, maybe find a better way sometime.
        });
    }

    addVideo(video) {
        this.managedVideos.push(video);
        let formats = [];
        if(video.hasMetadata) {
            for(const format of video.formats) {
                formats.push(format.serialize());
            }
        }
        let args = {
            action: "add",
            type: video.type,
            identifier:  video.identifier,
            url: video.url,
            title: video.title,
            duration: video.duration,
            audioOnly: video.audioOnly,
            subtitles: video.downloadSubs,
            loadSize: this.environment.settings.sizeMode === "full",
            hasFilesizes: video.hasFilesizes,
            formats: formats,
            selected_format_index: (video.hasMetadata) ? video.selected_format_index : null,
            thumbnail: video.thumbnail
        }
        this.window.webContents.send("videoAction", args);
    }

    downloadVideo(args) {
        let downloadVideo = this.getVideo(args.identifier);
        downloadVideo.audioOnly = args.type === "audio";
        downloadVideo.videoOnly = args.type === "videoOnly";
        if(!downloadVideo.audioOnly) {
            for (const format of downloadVideo.formats) {
                if (format.getDisplayName() === args.format) {
                    downloadVideo.selected_format_index = downloadVideo.formats.indexOf(format);
                    break;
                }
            }
        }
        downloadVideo.audioQuality = (downloadVideo.audioQuality != null) ? downloadVideo.audioQuality : "best";
        let progressBar = new ProgressBar(this, downloadVideo);
        downloadVideo.setQuery(new DownloadQuery(downloadVideo.url, downloadVideo, this.environment, progressBar));
        downloadVideo.query.connect().then(() => {
            //Backup done call, sometimes it does not trigger automatically from within the downloadQuery.
            if(downloadVideo.error) return;
            downloadVideo.downloaded = true;
            downloadVideo.query.progressBar.done(downloadVideo.audioOnly);
            this.updateGlobalButtons();
        });
    }

    downloadAllVideos(args) {
        let videosToDownload = [];
        let unifiedPlaylists = [];
        for(const videoObj of args.videos) {
            let video = this.getVideo(videoObj.identifier);
            if(video.videos == null) {
                if(video.downloaded || video.type !== "single") continue;
                video.audioOnly = videoObj.type === "audio";
                video.videoOnly = videoObj.type === "videoOnly";
                if(video.audioOnly) {
                    video.audioQuality = videoObj.format;
                } else {
                    for (const format of video.formats) {
                        if (format.getDisplayName() === videoObj.format) {
                            video.selected_format_index = video.formats.indexOf(format);
                            break;
                        }
                    }
                }
                video.audioQuality = (video.audioQuality != null) ? video.audioQuality : "best";
                videosToDownload.push(video);
            } else {
                unifiedPlaylists.push(video);
                this.getUnifiedVideos(video, video.videos, videoObj.type === "audio", videoObj.format, videoObj.downloadSubs);
                for(const unifiedVideo of video.videos) {
                    unifiedVideo.parentID = video.identifier;
                    unifiedVideo.parentSize = video.videos.length;
                    videosToDownload.push(unifiedVideo);
                }
            }
        }
        let progressBar = new ProgressBar(this, "queue");
        let downloadList = new DownloadQueryList(videosToDownload, this.environment, this, progressBar);
        for(const unifiedPlaylist of unifiedPlaylists) { unifiedPlaylist.setQuery(downloadList) }
        downloadList.start().then(() => {
            for(const unifiedPlaylist of unifiedPlaylists) { unifiedPlaylist.downloaded = true }
            this.updateGlobalButtons();
        })
    }

    getUnifiedVideos(playlist, videos, audioOnly, selectedFormat, subtitles) {
        playlist.audioOnly = audioOnly
        if(!playlist.audioOnly) {
            for (const video of videos) {
                let gotFormatMatch = false;
                for (const format of video.formats) {
                    video.downloadSubs = subtitles;
                    if (format.getDisplayName() === selectedFormat) {
                        video.selected_format_index = video.formats.indexOf(format);
                        gotFormatMatch = true;
                        break;
                    }
                }
                if (!gotFormatMatch) {
                    const suppliedFormat = Format.getFromDisplayName(selectedFormat);
                    const output = video.formats.reduce((prev, curr) => Math.abs(curr.height - suppliedFormat.height) < Math.abs(prev.height - suppliedFormat.height) ? curr : prev);
                    video.selected_format_index = video.formats.indexOf(output);
                }
            }
        } else {
            for(const video of videos) {
                video.downloadSubs = subtitles;
                video.audioOnly = true;
                video.audioQuality = (playlist.audioQuality != null) ? playlist.audioQuality : "best";
            }
        }
        playlist.audioQuality = (playlist.audioQuality != null) ? playlist.audioQuality : "best";
    }

    downloadUnifiedPlaylist(args) {
        const playlist = this.getVideo(args.identifier);
        const videos = playlist.videos;
        this.getUnifiedVideos(playlist, videos, args.type === "audio", args.format, playlist.downloadSubs);
        playlist.audioQuality = (playlist.audioQuality != null) ? playlist.audioQuality : "best";
        let progressBar = new ProgressBar(this, playlist);
        playlist.setQuery(new DownloadQueryList(videos, this.environment, this, progressBar));
        playlist.query.start().then(() => {
            //Backup done call, sometimes it does not trigger automatically from within the downloadQuery.
            playlist.downloaded = true;
            playlist.query.progressBar.done(playlist.audioOnly);
            this.updateGlobalButtons();
        });
    }

    async getSize(identifier, formatLabel, audioOnly, videoOnly, clicked) {
        const video = this.getVideo(identifier);
        const cachedSize = this.getCachedSize(video, formatLabel, audioOnly, videoOnly);
        if(cachedSize != null) {
            //The size for this format was already looked up
            return cachedSize;
        } else {
            //Size was not already looked up
            //Try looking it up
            if(!clicked && this.environment.settings.sizeMode === "click") {
                //The sizemode is click so when the lookup from renderer is initial it should not do anything.
                return null;
            } else {
                return await this.querySize(video, formatLabel, video.getFormatFromLabel(formatLabel), audioOnly, videoOnly);
            }
        }
    }

    async querySize(video, formatLabel, format, audioOnly, videoOnly) {
        const sizeQuery = new SizeQuery(video, audioOnly, videoOnly, audioOnly ? formatLabel : format, this.environment);
        const result = await sizeQuery.connect();
        if(audioOnly) {
            if(formatLabel === "best") {
                video.bestAudioSize = result
            } else {
                video.worstAudioSize = result
            }
        } else if(videoOnly) {
            const formatCopy = Format.getFromDisplayName(formatLabel);
            formatCopy.filesize = result;
            video.videoOnlySizeCache.push(formatCopy);
        }
        return result;
    }

    getCachedSize(video, formatLabel, audioOnly, videoOnly) {
        if(audioOnly) {
            let applicableSize;
            if (formatLabel === "best") applicableSize = video.bestAudioSize;
            else applicableSize = video.worstAudioSize;
            return applicableSize;
        } else if(videoOnly) {
            const cachedFormat = video.videoOnlySizeCache.find(format => format.getDisplayName() === formatLabel);
            if(cachedFormat != null) return cachedFormat.filesize;
            else return null;
        } else {
            return video.getFormatFromLabel(formatLabel).filesize;
        }
    }

    removeVideo(video) {
        this.managedVideos = this.managedVideos.filter(item => item.identifier !== video.identifier);
        this.window.webContents.send("videoAction", { action: "remove", identifier: video.identifier })
    }

    onError(identifier) {
        let video = this.getVideo(identifier);
        if(video.query != null) {
            video.query.cancel();
        }
        video.error = true;
        this.updateGlobalButtons();
    }

    updateProgress(video, progress_args) {
        let args;
        if(video === "queue") {
            args = {
                action: "totalProgress",
                identifier: video.identifier,
                progress: progress_args
            }
        } else {
            args = {
                action: "progress",
                identifier: video.identifier == null ? video : video.identifier,
                progress: progress_args
            }
        }
        try {
            this.window.webContents.send("videoAction", args);
        } catch(e) {
            console.log("Blocked webContents IPC call, the window object was destroyed.");
        }
    }

    stopSingle(identifier) {
        let video = this.getVideo(identifier);
        if(video.query != null) {
            video.query.cancel();
        }
        this.removeVideo(video);
    }

    async openVideo(args) {
        let video = this.getVideo(args.identifier);
        if(video.type === "playlist") {
            shell.openPath(video.downloadedPath);
            return;
        }
        fs.readdir(video.downloadedPath, (err, files) => {
            for(const file of files) {
                if(file.substr(0, file.lastIndexOf(".")) === video.getFilename()) {
                    if(args.type === "folder") {
                        shell.showItemInFolder(path.join(video.downloadedPath, file));
                    } else if(args.type === "item") {
                        shell.openPath(path.join(video.downloadedPath, file));
                    } else {
                        console.error("Wrong openVideo type specified.")
                    }
                    return;
                }
            }
            //Fallback
            if(args.type === "folder") {
                shell.showItemInFolder(video.downloadedPath);
            } else if(args.type === "item") {
                shell.openPath(path.join(video.downloadedPath, video.getFilename()) + ".mp4");
            } else {
                console.error("Wrong openVideo type specified.")
            }
        });
    }

    showInfo(identifier) {
        let video = this.getVideo(identifier);
        let args = {
            action: "info",
            metadata: video.serialize(),
            identifier: identifier
        };
        this.window.webContents.send("videoAction", args);
    }

    async saveInfo(identifier) {
        let video = this.getVideo(identifier);
        let result = await dialog.showSaveDialog(this.window, {
            defaultPath: path.join(this.environment.paths.downloadPath, "metadata_" + video.url.slice(-11)),
            buttonLabel: "Save metadata",
            filters: [
                { name: "JSON", extensions: ["json"] },
                { name: "All Files", extensions: ["*"] },
            ],
            properties: ["createDirectory"]
        });
        if(!result.canceled) {
            fs.writeFileSync(result.filePath, JSON.stringify(video.serialize(), null, 3));
        }
    }

    async saveThumb(link) {
        let result = await dialog.showSaveDialog(this.window, {
            defaultPath: path.join(this.environment.paths.downloadPath, "thumb_" + path.basename(url.parse(link).pathname)),
            buttonLabel: "Save thumbnail",
            filters: [
                { name: "Images", extensions: ["jpeg", "jpg", "png", "webp", "tiff", "bmp"] },
                { name: "All Files", extensions: ["*"] },
            ],
            properties: ["createDirectory"]
        });
        if(!result.canceled) {
            const path = result.filePath;
            const writer = fs.createWriteStream(path);
            const response = await axios.get(link,{ responseType: "stream" });
            response.data.pipe(writer);
        }
    }

    updateGlobalButtons() {
        let videos = [];
        for(const video of this.managedVideos) {
            let downloadable = this.isDownloadable(video);
            videos.push({identifier: video.identifier, downloadable: downloadable})
        }
        this.window.webContents.send("updateGlobalButtons", videos);
    }

    setSubtitle(value, identifier) {
        const video = this.getVideo(identifier);
        video.downloadSubs = value;
    }

    setGlobalSubtitle(value) {
        for(const video of this.managedVideos) {
            video.downloadSubs = value;
            this.environment.mainDownloadSubs = value;
        }
    }

    isDownloadable(video) {
        let usedVideo = video;
        if(video.type == null) {
            usedVideo = this.getVideo(video);
        }
        if(usedVideo.videos != null && !usedVideo.downloaded) return true;
        return !(usedVideo == null || usedVideo.type !== "single" || usedVideo.error || usedVideo.downloaded)
    }

    getVideo(identifier) {
        return this.managedVideos.find(item => {
            return item.identifier === identifier;
        });
    }

}
module.exports = QueryManager;
