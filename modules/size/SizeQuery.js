const Query = require("../types/Query");
const Utils = require("../Utils");
const fs = require('fs');

class SizeQuery extends Query {
    constructor(video, environment) {
        super(environment);
        this.video = video;
        this.video = video;
        this.format = video.formats[video.selected_format_index];
    }

    async connect() {
        //Enable spinner
        let formatArgument = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.video.audioQuality}audio[ext=m4a]/bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`;
        if(this.format.fps == null) {
            formatArgument = `bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`;
        }
        if(this.video.audioOnly) {
            formatArgument = `bestvideo+${this.video.audioQuality}audio/bestvideo+bestaudio/best`;
        }
        let output = await this.start(this.video.url, ["-J", "--flat-playlist", "-f", formatArgument]);
        let data = JSON.parse(output);
        let totalSize = 0;
        if(data.requested_formats != null) {
            if(this.video.audioOnly) {
                for(const requestedFormat of data.requested_formats) {
                    if(requestedFormat.vcodec === "none") {
                        totalSize += requestedFormat.filesize;
                        break;
                    }
                }
            } else {
                for (const requestedFormat of data.requested_formats) {
                    if (requestedFormat.filesize != null) {
                        totalSize += requestedFormat.filesize;
                    } else if (requestedFormat.filesize_approx != null) {
                        totalSize += requestedFormat.filesize_approx;
                    }
                }
            }
        }
        if(totalSize === 0) {
            if(!this.video.audioOnly) {
                this.format.filesize = null;
                this.format.filesize_label = "Unknown";
                return "";
            } else {
                return "Unknown";
            }
        } else {
            if(!this.video.audioOnly) {
                this.format.filesize = totalSize;
                this.format.filesize_label = Utils.convertBytes(totalSize);
                return this.format.filesize_label;
            } else {
                return Utils.convertBytes(totalSize);
            }
        }
    }
}

module.exports = SizeQuery;
