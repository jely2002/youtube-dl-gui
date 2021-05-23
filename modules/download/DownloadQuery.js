const Query = require("../types/Query")
const path = require("path")

class DownloadQuery extends Query {
    constructor(url, video, environment, progressBar, unifiedPlaylist) {
        super(environment, video.identifier);
        this.url = url;
        this.video = video;
        this.progressBar = progressBar;
        this.format = video.formats[video.selected_format_index];
        this.unifiedPlaylist = unifiedPlaylist;
    }

    cancel() {
        super.stop();
    }

    async connect() {
        let args = [];
        let output = path.join(this.environment.paths.downloadPath, this.environment.settings.nameFormat);
        if(this.video.audioOnly) {
            let numeralAudioQuality = (this.video.audioQuality === "best") ? "0" : "9";
            args = [
                '--extract-audio', '--audio-quality', numeralAudioQuality,
                '--audio-format', 'mp3',
                '--ffmpeg-location', this.environment.paths.ffmpeg,
                '--no-mtime',
                '--embed-thumbnail',
                '-o', output,
                '--output-na-placeholder', ""
            ];
        } else {
            if (this.video.formats.length !== 0) {
                let format;
                if(this.video.videoOnly) {
                    format = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]/bestvideo[height=${this.format.height}]/best[height=${this.format.height}]/bestvideo/best`;
                    if (this.format.fps == null) {
                        format = `bestvideo[height=${this.format.height}]/best[height=${this.format.height}]/bestvideo/best`
                    }
                } else {
                    format = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.video.audioQuality}audio/bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`;
                    if (this.format.fps == null) {
                        format = `bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`
                    }
                }
                args = [
                    "-f", format,
                    "-o", output,
                    '--ffmpeg-location', this.environment.paths.ffmpeg,
                    '--no-mtime',
                    '--output-na-placeholder', ""
                ];
            } else {
                args = [
                    "-o", output,
                    '--ffmpeg-location', this.environment.paths.ffmpeg,
                    '--no-mtime',
                    '--output-na-placeholder', ""
                ];
            }
            if (this.video.downloadSubs) {
                this.progressBar.setInitial("Downloading subtitles");
                args.push("--all-subs");
                args.push("--embed-subs");
                args.push("--sub-format")
                args.push("srt");
                args.push("--convert-subs");
                args.push("srt");
                if(this.environment.settings.autoGenSubs) {
                    args.push("--write-auto-sub");
                }
            }
            if (this.environment.settings.outputFormat !== "none") {
                args.push("--merge-output-format");
                args.push(this.environment.settings.outputFormat);
            }
        }
        if(this.environment.settings.downloadMetadata) {
            args.push('--add-metadata');
        }
        if(this.environment.settings.downloadThumbnail) {
            args.push('--write-thumbnail');
        }
        if(this.environment.settings.keepUnmerged) args.push('--keep-video');
        let destinationCount = 0;
        let initialReset = false;
        let result = null;
        try {
            result = await this.environment.downloadLimiter.schedule(() => this.start(this.url, args, (liveData) => {
                if(this.unifiedPlaylist) return;
                if (!liveData.includes("[download]")) return;
                if (!initialReset) {
                    initialReset = true;
                    this.progressBar.reset();
                }
                if (liveData.includes("Destination")) destinationCount += 1;
                if (destinationCount > 1) {
                    if (destinationCount === 2 && !this.video.audioOnly && !this.video.downloadingAudio) {
                        this.video.downloadingAudio = true;
                        this.progressBar.reset();
                    }
                }
                let liveDataArray = liveData.split(" ").filter((el) => {
                    return el !== ""
                });
                if (liveDataArray.length > 8) return;
                liveDataArray = liveDataArray.filter((el) => {
                    return el !== "\n"
                });
                let percentage = liveDataArray[1];
                let speed = liveDataArray[5];
                let eta = liveDataArray[7];
                this.progressBar.updateDownload(percentage, eta, speed, this.video.audioOnly ? true : this.video.downloadingAudio);
            }));
        } catch (exception) {
            this.environment.errorHandler.checkError(exception, this.video.identifier);
            return exception;
        }
        return result;
    }
}
module.exports = DownloadQuery;
