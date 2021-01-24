const DownloadQuery = require('./DownloadQuery');
const crypto = require("crypto");

class DownloadQueryList {
    constructor(videos, environment, progressBar) {
        this.videos = videos;
        this.environment = environment;
        this.progressBar = progressBar;
        this.limiterKey = crypto.randomBytes(16).toString("hex");
        this.length = this.videos.length;
        this.done = 0;
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            for(let video of this.videos) {
                let task = new DownloadQuery(video.webpage_url, video, this.environment, this.auth, this.progressBar);
                this.environment.limiterGroup.key(this.limiterKey).schedule(() => task.connect()).then(() => {
                    this.done++;
                    //this.progressBar.update(this.done, this.length); TODO FIX
                    if(this.done === this.length) {
                        this.environment.limiterGroup.deleteKey(this.limiterKey);
                        resolve();
                        //TODO Progress bar
                    }
                });
            }
        }))

    }
}

module.exports = DownloadQueryList;
