const DownloadQuery = require('./DownloadQuery');
const Format = require('../types/Format');
const Bottleneck = require('bottleneck');

class DownloadQueryList {
    constructor(data, environment, progressbar) {
        this.data = data;
        this.environment = environment;
        this.progressBar = progressbar;
        this.length = null;
        this.limiter = new Bottleneck({
            trackDoneStatus: true,
            minTime: 0,
            maxConcurrent: 4 //TODO auto configure depending on system cores (get from env)
        })
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            this.length = this.data.length;
            for(let video of this.data) {
                let task = new DownloadQuery(video.webpage_url, video, this.environment, this.auth, this.progressBar);
                this.limiter.schedule(() => task.connect()).then(() => {
                    const count = this.limiter.counts();
                    if(count.DONE === this.length) {
                        resolve()
                        //TODO Set progress bar to done
                    }
                });
            }
        }))

    }
}

module.exports = DownloadQueryList;
