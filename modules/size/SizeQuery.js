const Query = require("../types/Query");
const Utils = require("../Utils");

class SizeQuery extends Query {
    constructor(video, audioOnly, videoOnly, format, environment) {
        super(environment, video.identifier);
        this.video = video;
        this.audioOnly = audioOnly;
        this.videoOnly = videoOnly;
        this.audioQuality = environment.mainAudioQuality;
        this.format = format
    }

    async connect() {
        const encoding = this.video.selectedEncoding === "none" ? "" : "[vcodec=" + this.video.selectedEncoding + "]";
        const audioEncoding = this.video.selectedAudioEncoding === "none" ? "" : "[acodec=" + this.video.selectedAudioEncoding + "]";
        let formatArgument = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]${encoding}+${this.audioQuality}audio/bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.audioQuality}audio/bestvideo[height=${this.format.height}]+${this.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`;
        if(this.videoOnly) {
            formatArgument = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]${encoding}/bestvideo[height=${this.format.height}][fps=${this.format.fps}]/bestvideo[height=${this.format.height}]/best[height=${this.format.height}]/bestvideo/best`;
            if (this.format.fps == null) {
                formatArgument = `bestvideo[height=${this.format.height}]${encoding}/bestvideo[height=${this.format.height}]/best[height=${this.format.height}]/bestvideo/best`
            }
        } else {
            formatArgument = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]${encoding}+${this.video.audioQuality}audio${audioEncoding}/bestvideo[height=${this.format.height}][fps=${this.format.fps}]${encoding}+${this.video.audioQuality}audio/bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.video.audioQuality}audio/bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`;
            if (this.format.fps == null) {
                formatArgument = `bestvideo[height=${this.format.height}]${encoding}+${this.video.audioQuality}audio${audioEncoding}/bestvideo[height=${this.format.height}]${encoding}+${this.video.audioQuality}audio/bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`
            }
        }
        if(this.audioOnly) {
            formatArgument = `bestvideo+${this.format}audio/bestvideo+bestaudio/best`;
        }

        let output = await this.environment.metadataLimiter.schedule(() => this.start(this.video.url, ["-J", "--flat-playlist", "-f", formatArgument]));
        let data = JSON.parse(output);
        let totalSize = 0;
        if(data.requested_formats != null) {
            if(this.audioOnly) {
                for (const requestedFormat of data.requested_formats) {
                    if (requestedFormat.vcodec === "none") {
                        totalSize += requestedFormat.filesize;
                        break;
                    }
                }
            } else if(this.videoOnly) {
                for (const requestedFormat of data.requested_formats) {
                    if (requestedFormat.acodec === "none") {
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
            if(!this.audioOnly && !this.videoOnly) {
                this.format.filesize = null;
                this.format.filesize_label = "Unknown";
            }
            return "Unknown";
        } else {
            if(!this.audioOnly && !this.videoOnly) {
                this.format.filesize = totalSize;
                this.format.filesize_label = Utils.convertBytes(totalSize);
            }
            return totalSize
        }
    }
}

module.exports = SizeQuery;
