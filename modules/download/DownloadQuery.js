const Query = require("../types/Query")
const path = require("path")

class DownloadQuery extends Query {
    constructor(url, video, environment, progressBar) {
        super(environment, progressBar);
        this.url = url;
        this.video = video;
        this.progressBar = progressBar;
        this.format = video.formats[video.selected_format_index];
    }

    cancel() {
        this.stop();
    }

    async connect() {
        let args;
        if(this.video.audioOnly) {
            let numeralAudioQuality = (this.format.audioQuality === "best") ? "0" : "9";
            let output = path.join(this.environment.selectedDownloadPath, "'%(title).200s.%(ext)s") //.200 is to limit the max title length to 200 characters
            args = [
                '--extract-audio', '--audio-quality', numeralAudioQuality,
                '--audio-format', 'mp3',
                '--ffmpeg-location', this.environment.ffmpegBinary,
                '--no-mtime',
                '--embed-thumbnail',
                '-o', output,
                '--output-na-placeholder', ""
            ];
        } else {
            let output = path.join(this.environment.selectedDownloadPath, "%(title).200s-(%(height)sp%(fps).0d).%(ext)s")
            let format = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.video.audioQuality}audio[ext=m4a]/bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`;
            if(this.format.fps == null) {
                format = `bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`
            }
            //TODO Add setting to enable ALWAYS mp4
            args = [
                "-f", format,
                "-o", output,
                '--ffmpeg-location', this.environment.ffmpegBinary,
                "--recode-video", "mp4",
                '--no-mtime',
                '--output-na-placeholder', ""
            ];
            console.log(args)
            if (this.video.downloadSubs) {
                args.push("--all-subs")
                args.push("--embed-subs")
                args.push("--convert-subs")
                args.push("srt")
            }
        }
        if(this.environment.cookiePath != null) {
            args.push("--cookies");
            args.push(this.environment.cookiePath);
        }
        let destinationCount = 0;
        let initialReset = false;
        // TODO Add more error handling
        try {
            await this.start(this.url, args, (liveData) => {
                if(!liveData.includes("[download]")) return;
                if(!initialReset) {
                    initialReset = true;
                    this.progressBar.reset();
                }
                if(liveData.includes("Destination")) destinationCount += 1;
                if(destinationCount > 1) {
                    if(destinationCount === 2) this.video.audioOnly = true;
                    this.progressBar.reset();
                }
                let liveDataArray = liveData.split(" ").filter((el) => {return el !== ""});
                if(liveDataArray.length > 8) return;
                liveDataArray = liveDataArray.filter((el) => {return el !== "\n"});
                let percentage = liveDataArray[1];
                let speed = liveDataArray[5];
                let eta = liveDataArray[7];
                this.progressBar.updateDownload(percentage, eta, speed, this.video.audioOnly);
            })
        } catch(exception) {
            console.log(exception);
            return exception;
        }
    }
}
module.exports = DownloadQuery;
