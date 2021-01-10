const InfoQuery = require('./InfoQuery');
const Video = require('./Video');
const Bottleneck = require('bottleneck');

class InfoQueryList {
    constructor(urls, environment, progressBar) {
        this.urls = urls;
        this.environment = environment;
        this.progressBar = progressBar;
        this.length = null;
        this.limiter = new Bottleneck({
            trackDoneStatus: true,
            minTime: 0,
            maxConcurrent: 4 //TODO auto configure depending on system cores (get from env)
        });
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            let queries = null;
            if(this.urls.entries != null) {
                queries = this.urls.entries;
                this.length = this.urls.entries.length;
            } else if(this.urls.userSelection != null) {
                queries = this.urls.userSelection;
                this.length = this.urls.userSelection.length;
            } else {
                //TODO Add error handling (invalid url format)
                this.length = 0;
                resolve(null)
            }
            let totalMetadata = [];
            for (const entry of queries) {
                let url = (entry.ie_key != null && entry.ie_key === "Youtube") ? "https://youtube.com/watch?v=" + entry.url : entry.url;
                let task = new InfoQuery(url, this.environment, this.auth);
                this.limiter.schedule(() => task.connect()).then((metadata) => {
                    let availableFormats = task.parseAvailableFormats(metadata)
                    let video = new Video(url, availableFormats, metadata, this.environment);
                    totalMetadata.push(video);
                    const count = this.limiter.counts();
                    this.updateProgressbar(count);
                    if(count.DONE === this.length) {
                        resolve(totalMetadata);
                    }
                });
            }
        }));
    }

    updateProgressbar(counts) {
        const count = (counts == null) ? this.limiter.counts() : counts;
        const fraction = count.DONE / this.length;
        const percentage = Math.round(fraction * 100);
        const percentageString = percentage + "%";
        console.log(percentageString)
        //TODO update progressbar
    }
}

module.exports = InfoQueryList;
