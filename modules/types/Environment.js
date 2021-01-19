const fs = require("fs");
const path = require("path")
const mkdirp = require("mkdirp");
const Bottleneck = require("bottleneck");

class Environment {
    constructor(platform, appPath, homePath, downloadPath) {
        this.platform = platform;
        this.appPath = appPath;
        this.homePath = homePath;
        this.downloadPath = downloadPath;
        this.cookiePath = null;
        this.mainAudioOnly = false;
        this.mainAudioQuality = "best";
        this.mainDownloadSubs = false;
        this.ytdlBinary = "";
        this.ffmpegBinary = "";
        this.limiterGroup = new Bottleneck.Group({
            trackDoneStatus: true,
            maxConcurrent: 4,
            minTime: 0
        })
        this.setPaths();
        this.setPermissions();
        this.createHomeFolder();
    }
    setPaths() {
        switch (this.platform) {
            //TODO fully migrate to path.join
            case "win32":
                this.ytdlBinary = "resources/youtube-dl.exe";
                this.ffmpegBinary ="resources/ffmpeg.exe";
                break;
            case "darwin":
                this.appPath = this.appPath.slice(0,-8);
                this.ytdlBinary = this.appPath + "youtube-dl-darwin";
                this.ffmpegBinary = this.appPath + "ffmpeg";
                break;
            case "linux":
                this.appPath = this.homePath + "/.youtube-dl-gui/";
                this.ytdlBinary = this.appPath + "youtube-dl-darwin";
                this.ffmpegBinary = this.appPath + "ffmpeg";
                break;
        }
    }
    setPermissions() {
        if(this.platform === "linux") {
            fs.chmod(this.ytdlBinary, 0o755, (err) => {
                if(err) console.error(err);
            });
            fs.chmod(this.ffmpegBinary, 0o755, (err) => {
                if(err) console.error(err);
            });
        }
    }
    createHomeFolder() {
        if(this.platform !== "linux") return;
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
    resetLimiter(limiter) {
        let args = {
            trackDoneStatus: true,
            minTime: 0,
            maxConcurrent: 4 //TODO auto configure depending on system cores (get from env)
        };
        switch(limiter) {
            case "info":
                this.infoLimiter = new Bottleneck(args);
                break;
            case "size":
                this.sizeLimiter = new Bottleneck(args);
                break;
            case "download":
                this.downloadLimiter = new Bottleneck(args);
                break;
        }
    }
}
module.exports = Environment;
