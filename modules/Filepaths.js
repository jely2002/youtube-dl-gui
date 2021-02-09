const path = require('path');
const mkdirp = require("mkdirp");
const fs = require("fs");

//TODO Add icons and assets to this module
class Filepaths {
    constructor(app) {
        this.app = app;
        this.platform = process.platform;
        this.downloadPath = this.app.getPath('downloads');

        this.generateFilepaths();
        if(this.platform === "linux") {
            //Start linux fixes
            this.createHomeFolder();
            this.setPermissions();
        }
    }

    generateFilepaths() {
        const unpackedPrefix = "resources/app.asar.unpacked";
        const packedPrefix = "resources/app.asar";
        switch (this.platform) {
            //TODO find a better way for the macOS slice(0, -8) hack
            //TODO Test on darwin & linux (win32 only platform that has been tested 06/02/2021)
            case "win32":
                this.ffmpeg = this.app.isPackaged ? path.join(unpackedPrefix, "binaries/ffmpeg.exe") : "binaries/ffmpeg.exe";
                this.ytdl = this.app.isPackaged ? path.join(unpackedPrefix, "binaries/youtube-dl.exe") : "binaries/youtube-dl.exe";
                this.icon = this.app.isPackaged ? path.join(packedPrefix, "renderer/img/icon.png") : "renderer/img/icon.png";
                break;
            case "darwin":
                this.appPath = this.appPath.slice(0,-8);
                this.ytdl = path.join(this.appPath, "youtube-dl-darwin");
                this.ffmpeg = path.join(this.appPath, "ffmpeg");
                break;
            case "linux":
                this.homePath = this.app.getPath('home');
                this.appPath = path.join(this.homePath, "/.youtube-dl-gui/");
                this.ytdl = path.join(this.appPath, "youtube-dl-darwin");
                this.ffmpeg = path.join(this.appPath, "ffmpeg");
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

    createHomeFolder() {
        let readonlyResources = this.appPath.slice(0, -8)
        let destination = this.homePath + "/.youtube-dl-gui/"
        mkdirp(this.homePath + "/.youtube-dl-gui/").then(made => {
            if(made !== null) {
                fs.copyFile(readonlyResources + "youtube-dl-darwin", destination + "youtube-dl-darwin", (err) => {
                    if (err) throw err
                    console.log('youtube-dl-darwin copied to home data')
                })
                fs.copyFile(readonlyResources + "ffmpeg-linux", destination + "ffmpeg", (err) => {
                    if (err) throw err
                    console.log('ffmpeg copied to home data')
                })
                fs.copyFile(readonlyResources + "details", destination + "details", (err) => {
                    if (err) throw err
                    console.log('details copied to home data')
                })
            }
        })
    }
}

module.exports = Filepaths;
