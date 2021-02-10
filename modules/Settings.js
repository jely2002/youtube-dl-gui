const os = require("os");
const path = require("path");
const fs = require("fs").promises;

class Settings {
    constructor(paths, env, enforceMP4, sizeMode, maxConcurrent, updateBinary, updateApplication) {
        this.paths = paths;
        this.env = env
        this.enforceMP4 = enforceMP4 == null ? false : enforceMP4;
        this.sizeMode = sizeMode == null ? "full" : sizeMode;
        this.maxConcurrent = (maxConcurrent == null || maxConcurrent <= 0) ? Math.round(os.cpus().length / 2) : maxConcurrent; //Max concurrent is standard half of the system's available cores
        this.updateBinary = updateBinary == null ? true : updateBinary; //TODO Implement setting
        this.updateApplication = updateApplication == null ? true : updateApplication; //TODO Implement setting
    }

    static async loadFromFile(paths, env) {
        try {
            let result = await fs.readFile(paths.settings, "utf8");
            let data = JSON.parse(result);
            return new Settings(paths, env, data.enforceMP4, data.sizeMode, data.maxConcurrent, data.updateBinary, data.updateApplication);
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
        this.sizeMode = settings.sizeMode;
        if(this.maxConcurrent !== settings.maxConcurrent) {
            this.maxConcurrent = settings.maxConcurrent;
            this.env.changeMaxConcurrent(settings.maxConcurrent);
        }
        this.updateBinary = settings.updateBinary;
        this.updateApplication = settings.updateApplication;
        this.save();
    }

    serialize() {
        return {
            enforceMP4: this.enforceMP4,
            sizeMode: this.sizeMode,
            maxConcurrent: this.maxConcurrent,
            updateBinary: this.updateBinary,
            updateApplication: this.updateApplication
        }
    }

    save() {
        fs.writeFile(this.paths.settings, JSON.stringify(this.serialize()), "utf8").then(() => console.log("Saved settings file."));
    }
}

module.exports = Settings;
