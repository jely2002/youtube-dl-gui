const DownloadQuery = require('./DownloadQuery');
const ProgressBar = require("../types/ProgressBar");

class DownloadQueryList {
    constructor(videos, environment, manager, progressBar) {
        this.videos = videos;
        this.environment = environment;
        this.progressBar = progressBar;
        this.manager = manager;
        this.length = this.videos.length;
        this.done = 0;
        this.cancelled = 0;
    }

    async start() {
        return await new Promise(((resolve) => {
            for(let video of this.videos) {
                let progressBar = new ProgressBar(this.manager, video);
                let task = new DownloadQuery(video.webpage_url, video, this.environment, progressBar);
                video.setQuery(task);
                video.query.connect().then((returnValue) => {
                    if(returnValue === "killed") this.cancelled++;
                    if(returnValue !== "done") {
                        video.error = true;
                        this.environment.errorHandler.checkError(returnValue, video.identifier);
                    }
                    this.done++;
                    this.progressBar.updatePlaylist(this.done - this.cancelled, this.length - this.cancelled);
                    if(!video.error) {
                        video.downloaded = true;
                        video.query.progressBar.done();
                    }
                    if(this.done === this.length) {
                        resolve();
                    }
                });
            }
        }))

    }
}

module.exports = DownloadQueryList;
