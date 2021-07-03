const path = require('path');
const mkdirp = require("mkdirp");
const fs = require("fs");

class Filepaths {
    constructor(app, env) {
        this.app = app;
        this.env = env;
        this.platform = process.platform;
        this.appPath = this.app.getAppPath();
    }

     async generateFilepaths() {
        switch (this.detectPlatform()) {
            case "win32":
                this.unpackedPrefix = "resources/app.asar.unpacked";
                this.packedPrefix = "resources/app.asar";
                this.ffmpeg = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ffmpeg.exe") : "binaries/ffmpeg.exe";
                this.ytdl = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/youtube-dl.exe") : "binaries/youtube-dl.exe";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.settings = this.app.isPackaged ? path.join(this.unpackedPrefix, "userSettings") : "userSettings";
                this.taskList = this.app.isPackaged ? path.join(this.unpackedPrefix, "taskList") : "taskList";
                this.ytdlVersion = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ytdlVersion") :"binaries/ytdlVersion";
                break;
            case "win32portable":
                this.persistentPath = path.join(this.app.getPath('appData'), "youtube-dl-gui-portable");
                this.unpackedPrefix = "resources/app.asar.unpacked";
                this.packedPrefix = "resources/app.asar";
                await this.createPortableFolder();
                this.ffmpeg = path.join(this.persistentPath, "ffmpeg.exe");
                this.ytdl = path.join(this.persistentPath, "youtube-dl.exe");
                this.icon = path.join(this.packedPrefix, "renderer/img/icon.png");
                this.settings = path.join(this.persistentPath, "userSettings");
                this.taskList = path.join(this.persistentPath, "taskList");
                this.ytdlVersion = path.join(this.persistentPath, "ytdlVersion");
                break;
            case "darwin":
                this.packedPrefix = this.appPath;
                this.unpackedPrefix = this.appPath + ".unpacked";
                this.ffmpeg = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ffmpeg") : "binaries/ffmpeg";
                this.ytdl = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/youtube-dl-unix") : "binaries/youtube-dl-unix";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.settings = this.app.isPackaged ? path.join(this.unpackedPrefix, "userSettings") : "userSettings";
                this.taskList = this.app.isPackaged ? path.join(this.unpackedPrefix, "taskList") : "taskList";
                this.ytdlVersion = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ytdlVersion") :"binaries/ytdlVersion";
                this.setPermissions()
                break;
            case "linux":
                this.persistentPath = path.join(this.app.getPath('home'), ".youtube-dl-gui");
                this.packedPrefix = this.appPath;
                this.unpackedPrefix = this.appPath + ".unpacked";
                if(this.app.isPackaged) await this.createHomeFolder()
                this.ytdl = this.app.isPackaged ? path.join(this.persistentPath, "youtube-dl-unix") : "binaries/youtube-dl-unix";
                this.ffmpeg = this.app.isPackaged ? path.join(this.persistentPath, "ffmpeg") : "binaries/ffmpeg";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.settings = this.app.isPackaged ? path.join(this.persistentPath, "userSettings") : "userSettings";
                this.taskList = this.app.isPackaged ? path.join(this.persistentPath, "taskList") : "taskList";
                this.ytdlVersion = this.app.isPackaged ? path.join(this.persistentPath, "ytdlVersion") :"binaries/ytdlVersion";
                this.setPermissions()
                break;
        }
    }

    async validateDownloadPath() {
        const setPath = this.env.settings.downloadPath;
        try {
            await fs.promises.access(setPath);
            this.env.settings.downloadPath = setPath;
        } catch (e) {
            console.warn("The configured download path could not be found, switching to downloads folder.");
            this.setDefaultDownloadPath();
        }
    }

    setDefaultDownloadPath() {
        try {
            this.env.settings.downloadPath = this.app.getPath('downloads');
        } catch(e) {
            console.warn("Using home path as download location, as downloads was not found.");
            this.env.settings.downloadPath = this.app.getPath('home');
        }
    }

    detectPlatform() {
        if(this.appPath.includes("\\AppData\\Local\\Temp\\")) return "win32portable";
        else return this.platform;
    }

    setPermissions() {
        fs.chmod(this.ytdl, 0o755, (err) => {
            if(err) console.error(err);
        });
        fs.chmod(this.ffmpeg, 0o755, (err) => {
            if(err) console.error(err);
        });
    }

    async createPortableFolder() {
        await new Promise((resolve) => {
            mkdirp(this.persistentPath).then(made => {
                if (made != null) {
                    fs.copyFileSync(path.join(this.unpackedPrefix, "binaries/youtube-dl.exe"), path.join(this.persistentPath, "youtube-dl.exe"));
                    fs.copyFileSync(path.join(this.unpackedPrefix, "binaries/ffmpeg.exe"), path.join(this.persistentPath, "ffmpeg.exe"));
                    fs.copyFileSync(path.join(this.unpackedPrefix, "binaries/ytdlVersion"), path.join(this.persistentPath, "ytdlVersion"));
                }
                resolve();
            })
        })
    }

    async createHomeFolder() {
        await new Promise((resolve) => {
            mkdirp(this.persistentPath).then(made => {
                if (made != null) {
                    fs.copyFileSync(path.join(this.unpackedPrefix, "binaries/youtube-dl-unix"), path.join(this.persistentPath, "youtube-dl-unix"));
                    fs.copyFileSync(path.join(this.unpackedPrefix, "binaries/ffmpeg-linux"), path.join(this.persistentPath, "ffmpeg"));
                    fs.copyFileSync(path.join(this.unpackedPrefix, "binaries/ytdlVersion"), path.join(this.persistentPath, "ytdlVersion"));
                }
                resolve();
            })
        })
    }
}

module.exports = Filepaths;
