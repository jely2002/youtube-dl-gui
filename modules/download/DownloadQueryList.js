const DownloadQuery = require('./DownloadQuery');
const crypto = require("crypto");

class DownloadQueryList {
    constructor(data, environment, progressbar) {
        this.data = data;
        this.environment = environment;
        this.progressBar = progressbar;
        this.limiterKey = crypto.randomBytes(16).toString("hex");
        this.length = this.data.length;
        this.done = 0;
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            for(let video of this.data) {
                let task = new DownloadQuery(video.webpage_url, video, this.environment, this.auth, this.progressBar);
                this.environment.limiterGroup.key(this.limiterKey).schedule(() => task.connect()).then(() => {
                    if(this.done === this.length) {
                        this.environment.limiterGroup.deleteKey(this.limiterKey);
                        resolve()
                        //TODO Progress bar
                    }
                });
            }
        }))

    }
}

module.exports = DownloadQueryList;
