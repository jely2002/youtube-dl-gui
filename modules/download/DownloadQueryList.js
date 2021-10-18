const DownloadQuery = require('./DownloadQuery');
const ProgressBar = require("../types/ProgressBar");
const Utils = require("../Utils");

class DownloadQueryList {
    constructor(videos, playlistMetadata, environment, manager, progressBar) {
        this.videos = videos;
        this.playlistMetadata = playlistMetadata;
        this.environment = environment;
        this.progressBar = progressBar;
        this.manager = manager;
        this.length = this.videos.length;
        this.done = 0;
        this.cancelled = 0;
        this.parentProgress = [];
    }

    cancel() {
        for(const video of this.videos) {
            if(!video.downloaded) {
                video.query.cancel();
            }
        }
    }

    async start() {
        return await new Promise(((resolve) => {
            for(let video of this.videos) {
                let progressBar = new ProgressBar(this.manager, video);
                let task = new DownloadQuery(video.webpage_url, video, this.environment, progressBar, Utils.getVideoInPlaylistMetadata(video.url, null, this.playlistMetadata));
                if(video.parentID != null && !this.parentProgress.some(e => e.id === video.parentID)) {
                    const bar = new ProgressBar(this.manager, video.parentID);
                    this.parentProgress.push({
                        id: video.parentID,
                        done: 0,
                        cancelled: 0,
                        length: video.parentSize,
                        bar: bar
                    });
                    bar.updatePlaylist(0, video.parentSize);
                }
                video.setQuery(task);
                video.query.connect().then((returnValue) => {
                    if(video.parentID != null) {
                        const progress = this.parentProgress.find(e => e.id === video.parentID);
                        if(returnValue === "killed" || returnValue !== "done") progress.cancelled++;
                        progress.done++;
                        if (returnValue === "killed") this.cancelled++;
                        if (returnValue !== "done") {
                            video.error = true;
                            this.environment.errorHandler.checkError(returnValue, video.identifier);
                        }
                        this.done++;
                        progress.bar.updatePlaylist(progress.done - progress.cancelled, progress.length - progress.cancelled);
                        if(progress.done === progress.length) {
                            progress.bar.done(video.audioOnly);
                        }
                    } else {
                        if (returnValue === "killed") this.cancelled++;
                        if (returnValue !== "done") {
                            video.error = true;
                            this.environment.errorHandler.checkError(returnValue, video.identifier);
                        }
                        this.done++;
                    }
                    this.progressBar.updatePlaylist(this.done - this.cancelled, this.length - this.cancelled);
                    if(!video.error) {
                        if(this.environment.settings.downloadJsonMetadata) this.manager.saveInfo(video, false);
                        video.downloaded = true;
                        video.query.progressBar.done(video.audioOnly);
                    }
                    if(this.done === this.length) {
                        resolve();
                    }
                });
                this.progressBar.updatePlaylist(this.done - this.cancelled, this.length - this.cancelled);
            }
        }))

    }
}

module.exports = DownloadQueryList;
