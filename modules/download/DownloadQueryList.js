const DownloadQuery = require('./DownloadQuery');
const crypto = require("crypto");
const ProgressBar = require("../types/ProgressBar");

class DownloadQueryList {
    constructor(videos, environment, manager, progressBar) {
        this.videos = videos;
        this.environment = environment;
        this.progressBar = progressBar;
        this.manager = manager;
        this.limiterKey = crypto.randomBytes(16).toString("hex");
        this.length = this.videos.length;
        this.done = 0;
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            for(let video of this.videos) {
                let progressBar = new ProgressBar(this.manager, video);
                let task = new DownloadQuery(video.webpage_url, video, this.environment, progressBar);
                video.setQuery(task);
                this.environment.limiterGroup.key(this.limiterKey).schedule(() => video.query.connect()).then(() => {
                    this.done++;
                    video.query.progressBar.done();
                    video.downloaded = true;
                    this.progressBar.updatePlaylist(this.done, this.length)
                    if(this.done === this.length) {
                        this.environment.limiterGroup.deleteKey(this.limiterKey);
                        resolve();
                    }
                });
            }
        }))

    }
}

module.exports = DownloadQueryList;
