const os = require("os");
const { globalShortcut, clipboard } = require('electron');
const fs = require("fs").promises;

class Settings {
    constructor(
        paths, env, outputFormat, audioOutputFormat, downloadPath,
        proxy, rateLimit, autoFillClipboard, noPlaylist, globalShortcut, userAgent,
        validateCertificate, enableEncoding, taskList, nameFormat, nameFormatMode,
        sizeMode, splitMode, maxConcurrent, updateBinary, downloadType, updateApplication, cookiePath,
        statSend, sponsorblockMark, sponsorblockRemove, sponsorblockApi, downloadMetadata, downloadJsonMetadata,
        downloadThumbnail, keepUnmerged, calculateTotalSize, theme
    ) {
        this.paths = paths;
        this.env = env
        this.outputFormat = outputFormat == null ? "none" : outputFormat;
        this.audioOutputFormat = audioOutputFormat == null ? "none" : audioOutputFormat;
        this.downloadPath = downloadPath == null ? env.app.getPath("downloads") : downloadPath;
        this.proxy = proxy == null ? "" : proxy;
        this.rateLimit = rateLimit == null ? "" : rateLimit;
        this.autoFillClipboard = autoFillClipboard == null ? true : autoFillClipboard;
        this.noPlaylist = noPlaylist == null ? false : noPlaylist;
        this.globalShortcut = globalShortcut == null ? true : globalShortcut;
        this.userAgent = userAgent == null ? "spoof" : userAgent;
        this.validateCertificate = validateCertificate == null ? false : validateCertificate;
        this.enableEncoding = enableEncoding == null ? false : enableEncoding;
        this.taskList = taskList == null ? true : taskList;
        this.nameFormat = nameFormat == null ? "%(title).200s-(%(height)sp%(fps).0d).%(ext)s" : nameFormat;
        this.nameFormatMode = nameFormatMode == null ? "%(title).200s-(%(height)sp%(fps).0d).%(ext)s" : nameFormatMode;
        this.sponsorblockMark = sponsorblockMark == null ? "" : sponsorblockMark;
        this.sponsorblockRemove = sponsorblockRemove == null ? "" : sponsorblockRemove;
        this.sponsorblockApi = sponsorblockApi == null ? "https://sponsor.ajay.app" : sponsorblockApi;
        this.downloadMetadata = downloadMetadata == null ? true : downloadMetadata;
        this.downloadJsonMetadata = downloadJsonMetadata == null ? false : downloadJsonMetadata;
        this.downloadThumbnail = downloadThumbnail == null ? false : downloadThumbnail;
        this.keepUnmerged = keepUnmerged == null ? false : keepUnmerged;
        this.calculateTotalSize = calculateTotalSize == null ? true : calculateTotalSize;
        this.sizeMode = sizeMode == null ? "click" : sizeMode;
        this.splitMode = splitMode == null? "49" : splitMode;
        this.maxConcurrent = (maxConcurrent == null || maxConcurrent <= 0) ? Math.round(os.cpus().length / 2) : maxConcurrent; //Max concurrent is standard half of the system's available cores
        this.updateBinary = updateBinary == null ? true : updateBinary;
        this.downloadType = downloadType == null ? "video" : downloadType;
        this.updateApplication = updateApplication == null ? true : updateApplication;
        this.cookiePath = cookiePath;
        this.statSend = statSend == null ? false : statSend;
        this.theme = theme == null ? "dark" : theme;
        this.setGlobalShortcuts();
    }

    static async loadFromFile(paths, env) {
        try {
            let result = await fs.readFile(paths.settings, "utf8");
            let data = JSON.parse(result);
            return new Settings(
                paths,
                env,
                data.outputFormat,
                data.audioOutputFormat,
                data.downloadPath,
                data.proxy,
                data.rateLimit,
                data.autoFillClipboard,
                data.noPlaylist,
                data.globalShortcut,
                data.userAgent,
                data.validateCertificate,
                data.enableEncoding,
                data.taskList,
                data.nameFormat,
                data.nameFormatMode,
                data.sizeMode,
                data.splitMode,
                data.maxConcurrent,
                data.updateBinary,
                data.downloadType,
                data.updateApplication,
                data.cookiePath,
                data.statSend,
                data.sponsorblockMark,
                data.sponsorblockRemove,
                data.sponsorblockApi,
                data.downloadMetadata,
                data.downloadJsonMetadata,
                data.downloadThumbnail,
                data.keepUnmerged,
                data.calculateTotalSize,
                data.theme
            );
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
        this.audioOutputFormat = settings.audioOutputFormat;
        this.proxy = settings.proxy;
        this.rateLimit = settings.rateLimit;
        this.autoFillClipboard = settings.autoFillClipboard;
        this.noPlaylist = settings.noPlaylist;
        this.globalShortcut = settings.globalShortcut;
        this.userAgent = settings.userAgent;
        this.validateCertificate = settings.validateCertificate;
        this.enableEncoding = settings.enableEncoding;
        this.taskList = settings.taskList;
        this.nameFormat = settings.nameFormat;
        this.nameFormatMode = settings.nameFormatMode;
        this.sponsorblockMark = settings.sponsorblockMark;
        this.sponsorblockRemove = settings.sponsorblockRemove;
        this.sponsorblockApi = settings.sponsorblockApi;
        this.downloadMetadata = settings.downloadMetadata;
        this.downloadJsonMetadata = settings.downloadJsonMetadata;
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
        this.downloadType = settings.downloadType;
        this.updateApplication = settings.updateApplication;
        this.theme = settings.theme;
        this.save();

        //Prevent installing already downloaded updates on app close.
        this.env.appUpdater.setUpdateSetting(settings.updateApplication);
        this.setGlobalShortcuts();
    }

    serialize() {
        return {
            outputFormat: this.outputFormat,
            audioOutputFormat: this.audioOutputFormat,
            downloadPath: this.downloadPath,
            proxy: this.proxy,
            rateLimit: this.rateLimit,
            autoFillClipboard: this.autoFillClipboard,
            noPlaylist: this.noPlaylist,
            globalShortcut: this.globalShortcut,
            userAgent: this.userAgent,
            validateCertificate: this.validateCertificate,
            enableEncoding: this.enableEncoding,
            taskList: this.taskList,
            nameFormat: this.nameFormat,
            nameFormatMode: this.nameFormatMode,
            sizeMode: this.sizeMode,
            splitMode: this.splitMode,
            maxConcurrent: this.maxConcurrent,
            defaultConcurrent: Math.round(os.cpus().length / 2),
            updateBinary: this.updateBinary,
            downloadType: this.downloadType,
            updateApplication: this.updateApplication,
            cookiePath: this.cookiePath,
            statSend: this.statSend,
            sponsorblockMark: this.sponsorblockMark,
            sponsorblockRemove: this.sponsorblockRemove,
            sponsorblockApi: this.sponsorblockApi,
            downloadMetadata: this.downloadMetadata,
            downloadJsonMetadata: this.downloadJsonMetadata,
            downloadThumbnail: this.downloadThumbnail,
            keepUnmerged: this.keepUnmerged,
            calculateTotalSize: this.calculateTotalSize,
            theme: this.theme,
            version: this.env.version
        }
    }

    save() {
        fs.writeFile(this.paths.settings, JSON.stringify(this.serialize()), "utf8").then(() => {
            console.log("Saved settings file.")
        });
    }

    setGlobalShortcuts() {
        if(globalShortcut == null) return;
        if(!this.globalShortcut) {
            globalShortcut.unregisterAll();
        } else {
            if(!globalShortcut.isRegistered("Shift+CommandOrControl+V")) {
                globalShortcut.register('Shift+CommandOrControl+V', async () => {
                    this.env.win.webContents.send("addShortcut", clipboard.readText());
                });
            }
            if(!globalShortcut.isRegistered("Shift+CommandOrControl+D")) {
                globalShortcut.register('Shift+CommandOrControl+D', async () => {
                    this.env.win.webContents.send("downloadShortcut");
                });
            }
        }
    }
}

module.exports = Settings;
