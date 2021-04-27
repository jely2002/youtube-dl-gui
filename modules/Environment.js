const Bottleneck = require("bottleneck");
const Filepaths = require("./Filepaths");
const Settings = require("./persistence/Settings");
const Analytics = require("./Analytics");
const DetectPython = require("./DetectPython");
const fs = require("fs").promises;

class Environment {
    constructor(app) {
        this.app = app;
        this.version = app.getVersion();
        this.cookiePath = null;
        this.mainAudioOnly = false;
        this.mainVideoOnly = true;
        this.mainAudioQuality = "best";
        this.mainDownloadSubs = false;
        this.paths = new Filepaths(app);
        this.downloadLimiter = new Bottleneck({
            trackDoneStatus: true,
            maxConcurrent: 4,
            minTime: 0
        })
        this.metadataLimiter = new Bottleneck({
            trackDoneStatus: true,
            maxConcurrent: 4,
            minTime: 0
        })
    }

    //Read the settings and start required services
    async initialize() {
        await this.paths.generateFilepaths();
        this.settings = await Settings.loadFromFile(this.paths, this);
        this.changeMaxConcurrent(this.settings.maxConcurrent);
        if(this.settings.cookiePath != null) { //If the file does not exist anymore, null the value and save.
            fs.access(this.settings.cookiePath).catch(() => {
                this.settings.cookiePath = null;
                this.settings.save();
            })
        }
        if(process.platform === "linux") {
            const pythonDetect = new DetectPython();
            this.pythonCommand = await pythonDetect.detect();
        } else {
            this.pythonCommand = "python";
        }
        this.analytics = new Analytics(this.app.getVersion(), this.paths, this.settings);
    }

    changeMaxConcurrent(max) {
        const settings = {
            trackDoneStatus: true,
            maxConcurrent: max,
            minTime: 0
        }
        this.downloadLimiter.updateSettings(settings);
        this.metadataLimiter.updateSettings(settings);
    }
}
module.exports = Environment;
