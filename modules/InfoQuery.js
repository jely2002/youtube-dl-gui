const Query = require("./Query");
const Utils = require("./Utils")

class InfoQuery extends Query {
    constructor(url, environment, auth, progressBar) {
        super(environment, auth, progressBar);
        this.url = url;
    }

    async connect() {
       // if(Utils.isYouTubeChannel(this.url)) { TODO FIX YOUTUBE/VIMEO CHANNELS
       //     //TODO Move channel detection and sanitization one level higher
       //     let channelVideoUrl = Utils.sanitizeYouTubeChannel(this.url) + "/videos";
        //    return await this.start(channelVideoUrl, ["-J", "--flat-playlist"]);
       // } else {
            try {
                return await this.start(this.url, ["-J", "--flat-playlist"]);
            } catch (e) {
                if(e.stderr.includes("Unsupported URL")) { // TODO Add more error handling
                    console.log(`The url: ${this.url}, is not supported by youtube-dl.`);
                    return null;
                } else  {
                    console.log(e)
                }
            }
      //  }
    }
}
module.exports = InfoQuery;
