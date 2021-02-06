const Bottleneck = require("bottleneck");
const Filepaths = require("./Filepaths");

class Environment {
    constructor(app) {
        this.cookiePath = null;
        this.mainAudioOnly = false;
        this.mainAudioQuality = "best";
        this.mainDownloadSubs = false;
        this.mainQualitySort = "best";
        this.sizeMode = "click"
        this.paths = new Filepaths(app);
        this.limiterGroup = new Bottleneck.Group({
            trackDoneStatus: true,
            maxConcurrent: 4,
            minTime: 0
        })
    }

    setMain(args) {
        switch(args.setting) {
            case "subtitles":
                this.mainDownloadSubs = args.value;
                break;
            case "audioonly":
                this.mainAudioOnly = args.value;
                break;
            case "audioquality":
                this.mainAudioQuality = args.value;
                break;
            case "qualitysort":
                this.mainQualitySort = args.value;
                break;
        }
    }
    resetLimiter(limiter) {
        let args = {
            trackDoneStatus: true,
            minTime: 0,
            maxConcurrent: 4 //TODO auto configure depending on system cores (get from env)
        };
        switch(limiter) {
            case "info":
                this.infoLimiter = new Bottleneck(args);
                break;
            case "size":
                this.sizeLimiter = new Bottleneck(args);
                break;
            case "download":
                this.downloadLimiter = new Bottleneck(args);
                break;
        }
    }
}
module.exports = Environment;
