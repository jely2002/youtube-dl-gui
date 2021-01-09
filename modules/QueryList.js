const InfoQuery = require('./InfoQuery');
const DownloadQuery = require('./DownloadQuery');
const Format = require('./Format');
const Bottleneck = require('bottleneck');

class QueryList {
    constructor(urls, environment, auth, progressBar) {
        this.urls = JSON.parse(urls);
        this.environment = environment;
        this.auth = auth;
        this.progressBar = progressBar;
        this.length = null;
        this.limiter = new Bottleneck({
            trackDoneStatus: true,
            minTime: 0,
            maxConcurrent: 4 //TODO auto configure depending on system cores
        });
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            if(this.urls.entries != null) {
                //It is a plain playlist url
                this.length = this.urls.entries.length;
                let totalMetadata = [];
                for (const entry of this.urls.entries) {
                    let task = new InfoQuery(entry.webpage_url, this.environment, this.auth);
                    this.limiter.schedule(() => task.connect()).then((metadata) => {
                        console.log(JSON.parse(metadata).title);
                        totalMetadata.push(metadata);
                        const count = this.limiter.counts();
                        this.updateProgressbar(count);
                        if(count.DONE === this.length) {
                            resolve(totalMetadata);
                        }
                    });
                }
            } else {
                //It is a full blown metadata playlist
                this.length = this.urls.length;
                for(const video of this.urls) {
                    let format = new Format(video.height, video.fps, video.audioQuality, video.audioOnly);
                    let task = new DownloadQuery(video.webpage_url, format, this.environment, this.auth);
                    this.limiter.schedule(() => task.connect()).then((stdout) => {
                        const count = this.limiter.counts();
                        this.updateProgressbar(count);
                        if(count.DONE === this.length) {
                            resolve();
                        }
                    });
                }
            }
        }))
    }

    updateProgressbar(counts) {
        const count = (counts == null) ? this.limiter.counts() : counts;
        const fraction = count.DONE / this.length;
        const percentage = Math.round(fraction * 100);
        const percentageString = percentage + "%";
        //TODO update progressbar
    }
}

module.exports = QueryList;
