const InfoQuery = require("./info/InfoQuery");
const Video = require("./types/Video");
const Utils = require("./Utils");
const InfoQueryList = require("./info/InfoQueryList");
const ProgressBar = require("./types/ProgressBar");
const DownloadQuery = require("./download/DownloadQuery");
const { shell, dialog } = require('electron');
const path = require('path')
const fs = require("fs");
const SizeQuery = require("./size/SizeQuery");
const DownloadQueryList = require("./download/DownloadQueryList");

class QueryManager {
    constructor(window, environment) {
        this.window = window;
        this.environment = environment;
        this.managedVideos = [];
    }

    async manage(url) {
        const channelRegex = /(?:https|http)\:\/\/(?:[\w]+\.)?youtube\.com\/(?:c\/|channel\/|user\/)([a-zA-Z0-9\-]{1,})/
        let metadataVideo = new Video(url, "metadata", this.environment);
        this.addVideo(metadataVideo);
        const initialQuery = await new InfoQuery(url, metadataVideo.identifier, this.environment).connect();
        if(metadataVideo.error) return;
        if(channelRegex.test(url)) {
            const actualQuery = await new InfoQuery(initialQuery.entries[0].url, metadataVideo.identifier, this.environment).connect();
            if(metadataVideo.error) return;
            this.removeVideo(metadataVideo);
            if(actualQuery.entries == null || actualQuery.entries.length === 0) this.managePlaylist(initialQuery, url);
            else this.managePlaylist(actualQuery, initialQuery.entries[0].url);
            return;
        }

        this.removeVideo(metadataVideo);

        switch(Utils.detectInfoType(initialQuery)) {
            case "single":
                this.manageSingle(initialQuery, url);
                break;
            case "playlist":
                this.managePlaylist(initialQuery, url)
                break;
        }
    }

    manageSingle(initialQuery, url) {
        console.log("manageSingle")
        let video = new Video(url, "single", this.environment);
        video.setMetadata(initialQuery);
        this.addVideo(video);
        this.updateGlobalButtons();
        if(this.environment.settings.sizeMode === "full") this.startSizeQuery(video.identifier, video.formats[video.selected_format_index]);
    }

    managePlaylist(initialQuery, url) {
        console.log("manageList");
        let playlistVideo = new Video(url, "playlist", this.environment);
        this.addVideo(playlistVideo);
        const playlistQuery = new InfoQueryList(initialQuery, this.environment, new ProgressBar(this, playlistVideo));
        playlistQuery.start().then((videos) => {
            this.removeVideo(playlistVideo.identifier);
            for(const video of videos) {
                this.addVideo(video);
            }
            this.updateGlobalButtons();
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

    downloadAllVideos(args) {
        let videosToDownload = [];
        for(const videoObj of args.videos) {
            let video = this.getVideo(videoObj.identifier)
            if(video.downloaded || video.type !== "single") continue;
            video.audioOnly = videoObj.type === "audio";
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
        }
        let progressBar = new ProgressBar(this, "queue");
        let downloadList = new DownloadQueryList(videosToDownload, this.environment, this, progressBar)
        downloadList.start().then(() => {
            this.updateGlobalButtons();
        })
    }

    downloadVideo(args) {
        let downloadVideo = this.getVideo(args.identifier);
        downloadVideo.audioOnly = args.type === "audio";
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
            downloadVideo.query.progressBar.done();
            this.updateGlobalButtons();
        });
    }

    startSizeQuery(identifier, formatLabel, clicked) {
        let video = this.getVideo(identifier);
        if(video.audioOnly) {
            let applicableSize = video.bestAudioSize;
            if(formatLabel === "worst") {
                applicableSize = video.worstAudioSize;
            }
            if(applicableSize == null) {
                if (this.environment.settings.sizeMode === "click" && !clicked) {
                    this.window.webContents.send("videoAction", {action: "size", size: null, identifier: video.identifier})
                } else if (this.environment.settings.sizeMode === "full" || clicked) {
                    let sizeQuery = new SizeQuery(video, this.environment);
                    sizeQuery.connect().then((result) => {
                        if(formatLabel === "best") {
                            video.bestAudioSize = result;
                            this.window.webContents.send("videoAction", {action: "size", size: video.bestAudioSize, identifier: video.identifier})
                        } else {
                            video.worstAudioSize = result;
                            this.window.webContents.send("videoAction", {action: "size", size: video.worstAudioSize, identifier: video.identifier})
                        }
                    });
                }
            } else {
                if(formatLabel === "best") {
                    this.window.webContents.send("videoAction", {action: "size", size: video.bestAudioSize, identifier: video.identifier})
                } else {
                    this.window.webContents.send("videoAction", {action: "size", size: video.worstAudioSize, identifier: video.identifier})
                }
            }
        } else {
            let selectedFormat = formatLabel;
            if (selectedFormat == null) {
                selectedFormat = video.formats[video.selected_format_index]
            } else {
                for (const format of video.formats) {
                    if (format.getDisplayName() === formatLabel) {
                        video.selected_format_index = video.formats.indexOf(format);
                        selectedFormat = format;
                        break;
                    }
                }
            }
            if (selectedFormat.filesize_label == null) {
                if (this.environment.settings.sizeMode === "click" && !clicked) {
                    this.window.webContents.send("videoAction", {
                        action: "size",
                        size: null,
                        identifier: video.identifier
                    })
                } else if (this.environment.settings.sizeMode === "full" || clicked) {
                    let sizeQuery = new SizeQuery(video, this.environment);
                    sizeQuery.connect().then((result) => {
                        this.window.webContents.send("videoAction", {
                            action: "size",
                            size: result,
                            identifier: video.identifier
                        })
                    });
                }
            } else {
                this.window.webContents.send("videoAction", {
                    action: "size",
                    size: selectedFormat.filesize_label,
                    identifier: video.identifier
                })
            }
        }
    }

    removeVideo(video) {
        this.managedVideos = this.managedVideos.filter(item => item.identifier !== video.identifier);
        this.window.webContents.send("videoAction", { action: "remove", identifier: video.identifier })
    }

    onError(identifier) {
        let video = this.getVideo(identifier);
        if(video.query != null) {
            video.query.stop();
        }
        video.error = true;
        this.updateGlobalButtons();
    }

    updateProgress(video, progress_args) {
        let args = {
            action: "progress",
            identifier: (video === "queue") ? video : video.identifier,
            progress: progress_args
        }
        this.window.webContents.send("videoAction", args);
    }

    stopSingle(identifier) {
        let video = this.getVideo(identifier);
        if(video.query != null) {
            video.query.stop();
        }
        this.removeVideo(video);
    }

    async openVideo(args) {
        let video = this.getVideo(args.identifier);
        console.log(video.getFilename())
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

    setAudioOnly(identifier, value) {
        let video = this.getVideo(identifier);
        video.audioOnly = value;
    }

    setAudioQuality(identifier, value) {
        let video = this.getVideo(identifier);
        video.audioQuality = value;
    }

    updateGlobalButtons() {
        let videos = [];
        for(const video of this.managedVideos) {
            let downloadable = this.isDownloadable(video);
            videos.push({identifier: video.identifier, downloadable: downloadable})
        }
        this.window.webContents.send("updateGlobalButtons", videos);
    }

    isDownloadable(video) {
        let usedVideo = video;
        if(video.type == null) {
            usedVideo = this.getVideo(video);
        }
        return !(usedVideo == null || usedVideo.type !== "single" || usedVideo.error || usedVideo.downloaded)
    }

    isManaging(identifier) {
        return this.managedVideos.some(video => video.identifier === identifier);
    }

    getVideo(identifier) {
        return this.managedVideos.find(item => {
            return item.identifier === identifier;
        });
    }

}
module.exports = QueryManager;
