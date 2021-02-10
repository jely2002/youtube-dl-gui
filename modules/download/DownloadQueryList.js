const DownloadQuery = require('./DownloadQuery');
const ProgressBar = require("../types/ProgressBar");
const Utils = require("../Utils");

class DownloadQueryList {
    constructor(videos, environment, manager, progressBar) {
        this.videos = videos;
        this.environment = environment;
        this.progressBar = progressBar;
        this.manager = manager;
        this.limiterKey = Utils.getRandomID(16);
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
                    this.progressBar.updatePlaylist(this.done, this.length)
                    if(!video.error) {
                        video.downloaded = true;
                        video.query.progressBar.done();
                    }
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
