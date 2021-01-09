const fs = require("fs");
const path = require("path")

class Environment {
    constructor(platform, appPath, homePath, downloadPath) {
        this.platform = platform;
        this.appPath = appPath;
        this.homePath = homePath;
        this.downloadPath = downloadPath;
        this.ytdlBinary = "";
        this.ffmpegBinary = "";
        this.setPaths();
        this.setPermissions();
    }
    setPaths() {
        switch (this.platform) {
            //TODO fully migrate to path.join
            case "win32":
                this.ytdlBinary = path.join(this.appPath, "resources/youtube-dl.exe");
                this.ffmpegBinary = path.join(this.appPath, "resources/ffmpeg.exe");
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
}
module.exports = Environment;
