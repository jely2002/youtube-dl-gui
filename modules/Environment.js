const Bottleneck = require("bottleneck");
const Filepaths = require("./Filepaths");
const Settings = require("./Settings");

class Environment {
    constructor(app) {
        this.cookiePath = null;
        this.mainAudioOnly = false;
        this.mainAudioQuality = "best";
        this.mainDownloadSubs = false;
        this.mainQualitySort = "best";
        this.paths = new Filepaths(app);
        this.limiterGroup = new Bottleneck.Group({
            trackDoneStatus: true,
            maxConcurrent: this.settings,
            minTime: 0
        })
    }

    async loadSettings() {
        this.settings = await Settings.loadFromFile(this.paths, this);
    }

    changeMaxConcurrent(max) {
        this.limiterGroup.updateSettings({
            trackDoneStatus: true,
            maxConcurrent: max,
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
}
module.exports = Environment;
