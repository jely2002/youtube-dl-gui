const os = require("os");
const fs = require("fs").promises;

class Settings {
    constructor(paths, env, enforceMP4, sizeMode, maxConcurrent, updateBinary, updateApplication, cookiePath, statSend, downloadMetadata, keepUnmerged, calculateTotalSize) {
        this.paths = paths;
        this.env = env
        this.enforceMP4 = enforceMP4 == null ? false : enforceMP4;
        this.downloadMetadata = downloadMetadata == null ? true : downloadMetadata;
        this.keepUnmerged = keepUnmerged == null ? false : keepUnmerged;
        this.calculateTotalSize = calculateTotalSize == null ? true : calculateTotalSize;
        this.sizeMode = sizeMode == null ? "full" : sizeMode;
        this.maxConcurrent = (maxConcurrent == null || maxConcurrent <= 0) ? Math.round(os.cpus().length / 2) : maxConcurrent; //Max concurrent is standard half of the system's available cores
        this.updateBinary = updateBinary == null ? true : updateBinary;
        this.updateApplication = updateApplication == null ? true : updateApplication;
        this.cookiePath = cookiePath;
        this.statSend = statSend == null ? false : statSend;
    }

    static async loadFromFile(paths, env) {
        try {
            let result = await fs.readFile(paths.settings, "utf8");
            let data = JSON.parse(result);
            return new Settings(paths, env, data.enforceMP4, data.sizeMode, data.maxConcurrent, data.updateBinary, data.updateApplication, data.cookiePath, data.statSend, data.downloadMetadata, data.keepUnmerged, data.calculateTotalSize);
        } catch(err) {
            console.log(err);
            let settings = new Settings(paths, env);
            settings.save();
            console.log("Created new settings file.")
            return settings;
        }
    }

    update(settings) {
        this.enforceMP4 = settings.enforceMP4;
        this.downloadMetadata = settings.downloadMetadata;
        this.keepUnmerged = settings.keepUnmerged;
        this.calculateTotalSize = settings.calculateTotalSize;
        this.sizeMode = settings.sizeMode;
        if(this.maxConcurrent !== settings.maxConcurrent) {
            this.maxConcurrent = settings.maxConcurrent;
            this.env.changeMaxConcurrent(settings.maxConcurrent);
        }
        this.updateBinary = settings.updateBinary;
        this.updateApplication = settings.updateApplication;
        this.save();

        //Prevent installing already downloaded updates on app close.
        this.env.appUpdater.setUpdateSetting(settings.updateApplication);
    }

    serialize() {
        return {
            enforceMP4: this.enforceMP4,
            sizeMode: this.sizeMode,
            maxConcurrent: this.maxConcurrent,
            defaultConcurrent: Math.round(os.cpus().length / 2),
            updateBinary: this.updateBinary,
            updateApplication: this.updateApplication,
            cookiePath: this.cookiePath,
            statSend: this.statSend,
            downloadMetadata: this.downloadMetadata,
            keepUnmerged: this.keepUnmerged,
            calculateTotalSize: this.calculateTotalSize,
            version: this.env.version
        }
    }

    save() {
        fs.writeFile(this.paths.settings, JSON.stringify(this.serialize()), "utf8").then(() => console.log("Saved settings file."));
    }
}

module.exports = Settings;
