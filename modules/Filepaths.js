const path = require('path');
const mkdirp = require("mkdirp");
const fs = require("fs");

//TODO Add icons and assets to this module
class Filepaths {
    constructor(app) {
        this.app = app;
        this.platform = process.platform;
        this.downloadPath = this.app.getPath('downloads');
        this.appPath = this.app.getAppPath();
        this.generateFilepaths();
    }

    async generateFilepaths() {
        switch (this.platform) {
            case "win32":
                this.unpackedPrefix = "resources/app.asar.unpacked";
                this.packedPrefix = "resources/app.asar";
                this.ffmpeg = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ffmpeg.exe") : "binaries/ffmpeg.exe";
                this.ytdl = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/youtube-dl.exe") : "binaries/youtube-dl.exe";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                break;
            case "darwin":
                this.packedPrefix = this.appPath;
                this.unpackedPrefix = this.appPath + ".unpacked";
                this.ffmpeg = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/ffmpeg") : "binaries/ffmpeg";
                this.ytdl = this.app.isPackaged ? path.join(this.unpackedPrefix, "binaries/youtube-dl-unix") : "binaries/youtube-dl-unix";
                this.icon = this.app.isPackaged ? path.join(this.packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                this.setPermissions()
                break;
            case "linux":
                this.persistentPath = path.join(this.app.getPath('home'), ".youtube-dl-gui");
                this.packedPrefix = this.appPath;
                this.unpackedPrefix = this.appPath + ".unpacked";
                await this.createHomeFolder()
                this.ytdl = path.join(this.persistentPath, "youtube-dl-unix");
                this.ffmpeg = path.join(this.persistentPath, "ffmpeg");
                this.setPermissions()
                break;
        }
    }

    setPermissions() {
        fs.chmod(this.ytdl, 0o755, (err) => {
            if(err) console.error(err);
        });
        fs.chmod(this.ffmpeg, 0o755, (err) => {
            if(err) console.error(err);
        });
    }

    async createHomeFolder() {
        await new Promise((resolve) => {
            mkdirp(this.persistentPath).then(made => {
                if (made !== null) {
                    fs.copyFileSync(path.join(this.unpackedPrefix, "youtube-dl-unix"), path.join(this.persistentPath, "binaries/youtube-dl-unix"));
                    fs.copyFileSync(path.join(this.unpackedPrefix, "ffmpeg-linux"), path.join(this.persistentPath, "binaries/ffmpeg"));
                    fs.copyFileSync(path.join(this.packedPrefix, "details"), path.join(this.persistentPath, "binaries/details"));
                }
            })
        })
    }
}

module.exports = Filepaths;
