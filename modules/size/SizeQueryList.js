const SizeQuery = require("./SizeQuery");

//**** THIS CLASS IS CURRENTLY NOT USED AND/OR NOT WORKING ****//

class SizeQueryList {
    constructor(videos, environment, progressBar) {
        this.videos = videos;
        this.environment = environment;
        this.progressBar = progressBar;
        this.done = 0
        this.length = videos.length;
    }

    async start() {
        return await new Promise(((resolve, reject) => {
            for(const video of this.videos) {
                let task = new SizeQuery(video, this.environment, this.progressBar);
                task.connect().then(() => {
                    if(this.done === this.length) {
                        resolve();
                    }
                });
            }
        }));
    }
}

module.exports = SizeQueryList;
