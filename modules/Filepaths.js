const path = require('path');
const mkdirp = require("mkdirp");
const fs = require("fs");

class Filepaths {
    constructor(app, env) {
        this.app = app;
        this.env = env;
        this.appPath = this.app.getAppPath();
        this.platform = this.detectPlatform();
    }

     async generateFilepaths() {
        switch (this.platform) {
            case "win32":
                this.unpackedPrefix = path.join(path.dirname(this.appPath), "app.asar.unpacked");
                this.packedPrefix = this.appPath;
                this.ffmpeg = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ffmpeg.exe") : "binaries/ffmpeg.exe";
                this.ytdl = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/youtube-dl.exe") : "binaries/youtube-dl.exe";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.settings = this.app.isPackaged ? path.join(this.unpackedPrefix, "userSettings") : "userSettings";
                this.taskList = this.app.isPackaged ? path.join(this.unpackedPrefix, "taskList") : "taskList";
                this.ytdlVersion = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ytdlVersion") :"binaries/ytdlVersion";
                break;
            case "win32app": {
                const appDir = path.basename(path.join(this.appPath, "../../..")).replace(/_(.*)_/g, "_");
                this.binaryPath = path.join(this.app.getPath('home'), "AppData/Local/Packages/" + appDir + "/LocalCache/Roaming/open-video-downloader-app");
                this.persistentPath = path.join(this.app.getPath("appData"), "open-video-downloader-app");
                this.unpackedPrefix = path.join(path.dirname(this.appPath), "app.asar.unpacked");
                this.packedPrefix = this.appPath;
                await this.createAppDataFolder();
                this.ffmpeg = path.join(this.binaryPath, "ffmpeg.exe");
                this.ytdl = path.join(this.binaryPath, "youtube-dl.exe");
                this.icon = path.join(this.packedPrefix, "renderer/img/icon.png");
                this.settings = path.join(this.binaryPath, "userSettings");
                this.taskList = path.join(this.binaryPath, "taskList");
                this.ytdlVersion = path.join(this.binaryPath, "ytdlVersion");
                break;
            }
            case "win32portable":
                this.persistentPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR , "open-video-downloader");
                this.unpackedPrefix = path.join(path.dirname(this.appPath), "app.asar.unpacked");
                this.packedPrefix = this.appPath;
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
        if(process.env.PORTABLE_EXECUTABLE_DIR != null) return "win32portable";
        else if(this.appPath.includes("WindowsApps")) return "win32app"
        else return process.platform;
    }

    setPermissions() {
        fs.chmod(this.ytdl, 0o755, (err) => {
            if(err) console.error(err);
        });
        fs.chmod(this.ffmpeg, 0o755, (err) => {
            if(err) console.error(err);
        });
    }

    async createAppDataFolder() {
        const from = path.join(this.unpackedPrefix, "binaries");
        const toCopy = ["youtube-dl.exe", "ffmpeg.exe", "ytdlVersion", "AtomicParsley.exe"];
        await this.copyFiles(from, this.persistentPath, toCopy);
    }

    async createPortableFolder() {
        try {
            await fs.promises.access(process.env.PORTABLE_EXECUTABLE_DIR, fs.constants.W_OK);
            if(await this.migrateExistingAppDataFolder()) return;
            const from = path.join(this.unpackedPrefix, "binaries");
            const toCopy = ["youtube-dl.exe", "ffmpeg.exe", "ytdlVersion", "AtomicParsley.exe"];
            await this.copyFiles(from, this.persistentPath, toCopy);
        } catch (e) {
            setTimeout(() => console.error(e), 5000);
            this.persistentPath = path.join(this.app.getPath("appData"), "open-video-downloader");
            await this.createAppDataFolder();
        }
    }

    async migrateExistingAppDataFolder() {
        const from = path.join(this.app.getPath("appData"), "youtube-dl-gui-portable");
        try {
            await fs.promises.access(from, fs.constants.W_OK);
            const toCopy = ["youtube-dl.exe", "ffmpeg.exe", "ytdlVersion", "userSettings", "taskList"];
            await this.copyFiles(from, this.persistentPath, toCopy);
            try {
                await fs.promises.rmdir(from, {recursive: true});
            } catch (e) {
                console.error(e);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async createHomeFolder() {
        const from = path.join(this.unpackedPrefix, "binaries");
        const toCopy = ["youtube-dl-unix", "ffmpeg-linux", "ytdlVersion"];
        await this.copyFiles(from, this.persistentPath, toCopy);
    }

    async copyFiles(from, to, files) {
        await new Promise((resolve) => {
            mkdirp(to).then(made => {
                if (made != null) {
                    for (const file of files) {
                        this.copyFile(from, to, file);
                    }
                }
                resolve();
            });
        });
    }

    copyFile(from, to, filename) {
        try {
            fs.copyFileSync(path.join(from, filename), path.join(to, filename));
        } catch (e) {
            console.error("Could not copy " + filename + " to " + to + ".");
        }
    }
}

module.exports = Filepaths;
