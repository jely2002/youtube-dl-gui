const InfoQuery = require("./info/InfoQuery");
const Video = require("./types/Video");
const Utils = require("./Utils");
const InfoQueryList = require("./info/InfoQueryList");
const SizeQueryList = require("./size/SizeQueryList");
const ProgressBar = require("./types/ProgressBar");
const DownloadQuery = require("./download/DownloadQuery");
const { shell, dialog } = require('electron');
const path = require('path')
const fs = require("fs");

class QueryManager {

    //TODO ADD SIZE QUERY TO CALCULATE SIZE ACCORDING TO SETTINGS
    //TODO Fully async size query and show spinner

    constructor(window, environment) {
        this.window = window;
        this.environment = environment;
        this.managedVideos = [];
    }

    async manage(url) {
        let metadataVideo = new Video(url, "metadata", this.environment);
        this.addVideo(metadataVideo);
        //this.window.webContents.send("UIAction", {"action": "lock", "elements": ["#add-url", "#add-url-btn"], "state": true});
        const initialQuery = await new InfoQuery(url, this.environment).connect();
        //this.window.webContents.send("UIAction", {"action": "lock", "elements": ["#add-url", "#add-url-btn"], "state": false});
        this.removeVideo(metadataVideo.identifier);

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
            formats: formats,
            selected_format_index: (video.hasMetadata) ? video.selected_format_index : null,
            thumbnail: video.thumbnail
        }
        this.window.webContents.send("videoAction", args);
    }

    downloadVideo(args) {
        let downloadVideo = this.getVideo(args.identifier);
        downloadVideo.audioOnly = args.type === "audio";
        console.log(downloadVideo.audioOnly)
        if(downloadVideo.audioOnly) {
            downloadVideo.audioQuality = args.format;
        } else {
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
            downloadVideo.query.progressBar.done();
        });
    }

    removeVideo(identifier) {
        this.managedVideos = this.managedVideos.filter(item => item.identifier !== identifier);
        this.window.webContents.send("videoAction", { action: "remove", identifier: identifier })
    }

    updateProgress(video, progress_args) {
        let args = {
            action: "progress",
            identifier: video.identifier,
            progress: progress_args
        }
        this.window.webContents.send("videoAction", args);
    }

    stopSingle(identifier) {
        let video = this.getVideo(identifier);
        if(video.query != null) {
            video.query.stop();
        }
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
            defaultPath: path.join(this.environment.selectedDownloadPath, "metadata_" + video.url.slice(-11)),
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

    getVideo(identifier) {
        return this.managedVideos.find(item => {
            return item.identifier === identifier;
        });
    }

}
module.exports = QueryManager;
