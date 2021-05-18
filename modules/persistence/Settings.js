const os = require("os");
const fs = require("fs").promises;

class Settings {
    constructor(paths, env, outputFormat, spoofUserAgent, validateCertificate, taskList, autoGenSubs, nameFormat, nameFormatMode, sizeMode, splitMode, maxConcurrent, updateBinary, updateApplication, cookiePath, statSend, downloadMetadata, downloadThumbnail, keepUnmerged, calculateTotalSize, theme) {
        this.paths = paths;
        this.env = env
        this.outputFormat = outputFormat == null ? "none" : outputFormat;
        this.spoofUserAgent = spoofUserAgent == null ? true : spoofUserAgent;
        this.validateCertificate = validateCertificate == null ? false : validateCertificate;
        this.taskList = taskList == null ? true : taskList;
        this.autoGenSubs = autoGenSubs == null ? false : autoGenSubs;
        this.nameFormat = nameFormat == null ? "%(title).200s-(%(height)sp%(fps).0d).%(ext)s" : nameFormat;
        this.nameFormatMode = nameFormatMode == null ? "%(title).200s-(%(height)sp%(fps).0d).%(ext)s" : nameFormatMode;
        this.downloadMetadata = downloadMetadata == null ? true : downloadMetadata;
        this.downloadThumbnail = downloadThumbnail == null ? false : downloadThumbnail;
        this.keepUnmerged = keepUnmerged == null ? false : keepUnmerged;
        this.calculateTotalSize = calculateTotalSize == null ? true : calculateTotalSize;
        this.sizeMode = sizeMode == null ? "click" : sizeMode;
        this.splitMode = splitMode == null? "49" : splitMode;
        this.maxConcurrent = (maxConcurrent == null || maxConcurrent <= 0) ? Math.round(os.cpus().length / 2) : maxConcurrent; //Max concurrent is standard half of the system's available cores
        this.updateBinary = updateBinary == null ? true : updateBinary;
        this.updateApplication = updateApplication == null ? true : updateApplication;
        this.cookiePath = cookiePath;
        this.statSend = statSend == null ? false : statSend;
        this.theme = theme == null ? "dark" : theme;
    }

    static async loadFromFile(paths, env) {
        try {
            let result = await fs.readFile(paths.settings, "utf8");
            let data = JSON.parse(result);
            return new Settings(paths, env, data.outputFormat, data.spoofUserAgent, data.validateCertificate, data.taskList, data.autoGenSubs, data.nameFormat, data.nameFormatMode, data.sizeMode, data.splitMode, data.maxConcurrent, data.updateBinary, data.updateApplication, data.cookiePath, data.statSend, data.downloadMetadata, data.downloadThumbnail, data.keepUnmerged, data.calculateTotalSize, data.theme);
        } catch(err) {
            console.log(err);
            let settings = new Settings(paths, env);
            settings.save();
            console.log("Created new settings file.")
            return settings;
        }
    }

    update(settings) {
        this.outputFormat = settings.outputFormat;
        this.spoofUserAgent = settings.spoofUserAgent;
        this.validateCertificate = settings.validateCertificate;
        this.taskList = settings.taskList;
        this.autoGenSubs = settings.autoGenSubs;
        this.nameFormat = settings.nameFormat;
        this.nameFormatMode = settings.nameFormatMode;
        this.downloadMetadata = settings.downloadMetadata;
        this.downloadThumbnail = settings.downloadThumbnail;
        this.keepUnmerged = settings.keepUnmerged;
        this.calculateTotalSize = settings.calculateTotalSize;
        this.sizeMode = settings.sizeMode;
        this.splitMode = settings.splitMode;
        if(this.maxConcurrent !== settings.maxConcurrent) {
            this.maxConcurrent = settings.maxConcurrent;
            this.env.changeMaxConcurrent(settings.maxConcurrent);
        }
        this.updateBinary = settings.updateBinary;
        this.updateApplication = settings.updateApplication;
        this.theme = settings.theme;
        this.save();

        //Prevent installing already downloaded updates on app close.
        this.env.appUpdater.setUpdateSetting(settings.updateApplication);
    }

    serialize() {
        return {
            outputFormat: this.outputFormat,
            spoofUserAgent: this.spoofUserAgent,
            validateCertificate: this.validateCertificate,
            taskList: this.taskList,
            autoGenSubs: this.autoGenSubs,
            nameFormat: this.nameFormat,
            nameFormatMode: this.nameFormatMode,
            sizeMode: this.sizeMode,
            splitMode: this.splitMode,
            maxConcurrent: this.maxConcurrent,
            defaultConcurrent: Math.round(os.cpus().length / 2),
            updateBinary: this.updateBinary,
            updateApplication: this.updateApplication,
            cookiePath: this.cookiePath,
            statSend: this.statSend,
            downloadMetadata: this.downloadMetadata,
            downloadThumbnail: this.downloadThumbnail,
            keepUnmerged: this.keepUnmerged,
            calculateTotalSize: this.calculateTotalSize,
            theme: this.theme,
            version: this.env.version
        }
    }

    save() {
        fs.writeFile(this.paths.settings, JSON.stringify(this.serialize()), "utf8").then(() => console.log("Saved settings file."));
    }
}

module.exports = Settings;
