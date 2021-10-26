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
                this.ffmpeg = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries") : "binaries";
                this.ytdl = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/yt-dlp.exe") : "binaries/yt-dlp.exe";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.settings = this.app.isPackaged ? path.join(this.unpackedPrefix, "userSettings") : "userSettings";
                this.taskList = this.app.isPackaged ? path.join(this.unpackedPrefix, "taskList") : "taskList";
                this.ytdlVersion = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ytdlVersion") :"binaries/ytdlVersion";
                this.ffmpegVersion = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ffmpegVersion") :"binaries/ffmpegVersion";
                break;
            case "win32app": {
                const appDir = path.basename(path.join(this.appPath, "../../..")).replace(/_(.*)_/g, "_");
                this.binaryPath = path.join(this.app.getPath('home'), "AppData/Local/Packages/" + appDir + "/LocalCache/Roaming/open-video-downloader-app");
                this.persistentPath = path.join(this.app.getPath("appData"), "open-video-downloader-app");
                this.unpackedPrefix = path.join(path.dirname(this.appPath), "app.asar.unpacked");
                this.packedPrefix = this.appPath;
                await this.createFolder(this.persistentPath);
                this.ffmpeg = this.binaryPath;
                this.ytdl = path.join(this.binaryPath, "yt-dlp.exe");
                this.icon = path.join(this.packedPrefix, "renderer/img/icon.png");
                this.settings = path.join(this.binaryPath, "userSettings");
                this.taskList = path.join(this.binaryPath, "taskList");
                this.ytdlVersion = path.join(this.binaryPath, "ytdlVersion");
                this.ffmpegVersion = path.join(this.binaryPath, "ffmpegVersion");
                break;
            }
            case "win32portable":
                this.persistentPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR , "open-video-downloader");
                this.unpackedPrefix = path.join(path.dirname(this.appPath), "app.asar.unpacked");
                this.packedPrefix = this.appPath;
                await this.createPortableFolder();
                this.ffmpeg = this.persistentPath;
                this.ytdl = path.join(this.persistentPath, "yt-dlp.exe");
                this.icon = path.join(this.packedPrefix, "renderer/img/icon.png");
                this.settings = path.join(this.persistentPath, "userSettings");
                this.taskList = path.join(this.persistentPath, "taskList");
                this.ytdlVersion = path.join(this.persistentPath, "ytdlVersion");
                this.ffmpegVersion = path.join(this.persistentPath, "ffmpegVersion");
                break;
            case "darwin":
                this.packedPrefix = this.appPath;
                this.unpackedPrefix = this.appPath + ".unpacked";
                this.ffmpeg = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries") : "binaries";
                this.ytdl = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/yt-dlp-unix") : "binaries/yt-dlp-unix";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.settings = this.app.isPackaged ? path.join(this.unpackedPrefix, "userSettings") : "userSettings";
                this.taskList = this.app.isPackaged ? path.join(this.unpackedPrefix, "taskList") : "taskList";
                this.ytdlVersion = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ytdlVersion") :"binaries/ytdlVersion";
                this.ffmpegVersion = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ffmpegVersion") :"binaries/ffmpegVersion";
                this.setPermissions()
                break;
            case "linux":
                this.persistentPath = path.join(this.app.getPath('home'), ".youtube-dl-gui");
                this.packedPrefix = this.appPath;
                this.unpackedPrefix = this.appPath + ".unpacked";
                if(this.app.isPackaged) await this.createFolder(this.persistentPath);
                this.ytdl = this.app.isPackaged ? path.join(this.persistentPath, "yt-dlp-unix") : "binaries/yt-dlp-unix";
                this.ffmpeg = this.app.isPackaged ? this.persistentPath : "binaries";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.settings = this.app.isPackaged ? path.join(this.persistentPath, "userSettings") : "userSettings";
                this.taskList = this.app.isPackaged ? path.join(this.persistentPath, "taskList") : "taskList";
                this.ytdlVersion = this.app.isPackaged ? path.join(this.persistentPath, "ytdlVersion") :"binaries/ytdlVersion";
                this.ffmpegVersion = this.app.isPackaged ? path.join(this.persistentPath, "ffmpegVersion") :"binaries/ffmpegVersion";
                this.setPermissions()
                break;
        }
        await this.removeLeftOver();
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

    async removeLeftOver() {
        const filename = process.platform === "win32" ? "youtube-dl.exe" : "youtube-dl-unix";
        if (fs.existsSync(path.join(this.ffmpeg, filename))) {
            await fs.promises.unlink(path.join(this.ffmpeg, filename));
        }
    }

    setPermissions() {
        fs.readdirSync(this.ffmpeg).forEach(file => {
            if (file === "userSettings" || file === "ytdlVersion" || file === "taskList" || file === "ffmpegVersion") return;
            fs.chmod(path.join(this.ffmpeg, file), 0o755, (err) => {
                if(err) console.error(err);
            });
        });
    }

    async createPortableFolder() {
        try {
            await fs.promises.access(process.env.PORTABLE_EXECUTABLE_DIR, fs.constants.W_OK);
            if(await this.migrateExistingAppDataFolder()) return;
            const from = path.join(this.unpackedPrefix, "binaries");
            const toCopy = ["AtomicParsley.exe"];
            await this.copyFiles(from, this.persistentPath, toCopy);
        } catch (e) {
            setTimeout(() => console.error(e), 5000);
            this.persistentPath = path.join(this.app.getPath("appData"), "open-video-downloader");
            await this.createFolder(this.persistentPath);
        }
    }

    async migrateExistingAppDataFolder() {
        const from = path.join(this.app.getPath("appData"), "youtube-dl-gui-portable");
        try {
            await fs.promises.access(from, fs.constants.W_OK);
            const toCopy = ["yt-dlp.exe", "ffmpeg.exe", "ytdlVersion", "ffmpegVersion", "AtomicParsley.exe", "userSettings", "taskList"];
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

    async createFolder(path) {
        await new Promise((resolve) => {
            mkdirp(path).then(() => {
                resolve();
            });
        });
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
        const fromFile = path.join(from, filename);
        const toFile = path.join(to, filename);
        try {
            fs.copyFileSync(fromFile, toFile);
        } catch (e) {
            console.error("Could not copy " + filename + " to " + to + ".");
        }
    }
}

module.exports = Filepaths;
