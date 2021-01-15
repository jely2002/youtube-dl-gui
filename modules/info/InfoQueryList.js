const InfoQuery = require('./InfoQuery');
const SizeQuery = require('../size/SizeQuery');
const Video = require('../types/Video');
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
        this.sizeQueryLimiter = new Bottleneck({
            minTime: 0,
            maxConcurrent: 4 //TODO auto configure depending on system cores (get from env)
        });
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            let isUserSelection = false;
            let queries = null;
            if(this.urls.entries != null) {
                isUserSelection = false;
                queries = this.urls.entries;
                this.length = this.urls.entries.length;
            } else if(this.urls.userSelection != null) {
                console.log(this.urls)
                isUserSelection = true;
                queries = this.urls.userSelection;
                this.length = this.urls.userSelection.length;
            } else {
                //TODO Add error handling (invalid url format)
                console.error("Invalid URL format");
                this.length = 0;
                resolve(null);
            }
            let totalMetadata = [];
            for (const entry of queries) {
                //If entry.url is not set use entry.webpage_url
                //Apply youtube url fix
                let url = null;
                if(isUserSelection) {
                    url = entry;
                } else {
                    if (entry.url == null) url = entry.webpage_url;
                    else url = (entry.ie_key != null && entry.ie_key === "Youtube") ? "https://youtube.com/watch?v=" + entry.url : entry.url;
                }

                let task = new InfoQuery(url, this.environment, this.progressBar);
                this.limiter.schedule(() => task.connect()).then((data) => {
                    let metadata = (data.entries != null && data.entries.length === 1 && data.entries[0].formats != null) ? data.entries[0] : data;
                    let availableFormats = task.parseAvailableFormats(metadata);
                    let video = new Video(url, availableFormats, metadata, this.environment);
                    let sizeQuery = new SizeQuery(video, this.environment, this.progressBar);
                    this.sizeQueryLimiter.schedule(() => sizeQuery.connect()).then((size) => {
                        //console.log(size);
                        //console.log(video.formats[video.selected_format_index]);
                        //Do something for every sizequery when it is finished
                    });
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
