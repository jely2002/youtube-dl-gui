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
        this.done = 0;
        this.limiterKey = crypto.randomBytes(16).toString("hex");
    }

    async start() {
        let result = await new Promise(((resolve, reject) => {
            let totalMetadata = [];
            let playlistUrls = Utils.extractPlaylistUrls(this.query);
            for (const videoData of playlistUrls[1]) {
                let video = this.createVideo(videoData, videoData.url);
                totalMetadata.push(video);
            }
            this.urls = playlistUrls[0];
            this.length = this.urls.length;
            if (this.length === 0) resolve(totalMetadata);
            if (this.urls === []) {
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
                this.environment.limiterGroup.key(this.limiterKey).schedule(() => task.connect()).then((data) => {
                    let video = this.createVideo(data, url);
                    totalMetadata.push(video);
                    const count = this.limiter.counts();
                    this.updateProgressbar(count);
                    if(count.DONE === this.length) {
                        resolve(totalMetadata);
                    }
                });
            }
        }));
        await this.environment.limiterGroup.deleteKey(this.limiterKey);
        return result;
    }

    createVideo(data, url) {
        let metadata = (data.entries != null && data.entries.length === 1 && data.entries[0].formats != null) ? data.entries[0] : data;
        let video = new Video(url, "single", this.environment);
        video.setMetadata(metadata);
        return video;
    }

    updateProgressbar() {
        const fraction = this.done  / this.length;
        const percentage = (fraction * 100).toFixed(2);
        const percentageString = percentage + "%";
        this.progressBar.update(percentageString, this.done, this.length);
    }
}

module.exports = InfoQueryList;
