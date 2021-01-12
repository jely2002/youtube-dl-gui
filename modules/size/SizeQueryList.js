const SizeQuery = require("./SizeQuery");
const Bottleneck = require('bottleneck');

class SizeQueryList {
    constructor(videos, environment, progressBar) {
        this.videos = videos;
        this.environment = environment;
        this.progressBar = progressBar;
        this.limiter = new Bottleneck({
            minTime: 0,
            maxConcurrent: 4 //TODO auto configure depending on system cores (get from env)
        });
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            for(const video of this.videos) {
                let task = new SizeQuery(video, this.environment, this.progressBar);
                this.limiter.schedule(task.connect()).then((size) => {
                    const count = this.limiter.counts();
                    if(count.DONE === this.length) {
                        resolve();
                    }
                });
            }
        }));
    }
}

exports.module = SizeQueryList;
