const Query = require("./Query")
const path = require("path")

class DownloadQuery extends Query {
    constructor(url, format, environment, auth, progressBar) {
        super(environment, auth, progressBar);
        this.url = url;
        this.format = format;
    }

    async connect() {
        let args;
        if(this.format.audioOnly) {
            let numeralAudioQuality = (this.format.audioQuality === "best") ? "0" : "9";
            let output = path.join(this.environment.downloadPath, "'%(title).200s.%(ext)s") //.200 is to limit the max title length to 200 characters
            args = [
                '--extract-audio', '--audio-quality', numeralAudioQuality,
                '--audio-format', 'mp3',
                '--ffmpeg-location', this.environment.ffmpegBinary, '--hls-prefer-ffmpeg',
                '--no-mtime',
                '--embed-thumbnail',
                '-o', output,
            ];
        } else {
            let output = path.join(this.environment.downloadPath, "%(title).200s-(%(height)sp%(fps)s).%(ext)s")
            args = [
                "-f", `bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.format.audioQuality}audio[ext=m4a]/bestvideo[height=${this.format.height}]+${this.format.audioQuality}audio/bestvideo+bestaudio/best`,
                "-o", output,
                '--ffmpeg-location', this.environment.ffmpegBinary, '--hls-prefer-ffmpeg',
                '--no-mtime',
            ];
            console.log(args)
            if (this.environment.downloadSubs) {
                args.push("--all-subs")
                args.push("--embed-subs")
                args.push("--convert-subs")
                args.push("srt")
            }
        }
        if(super.isAuthUsed()) {
            if(this.auth.isCookie)  {
                args.push("--cookies");
                args.push(this.auth.id);
            } else {
                options.push('-u')
                options.push(this.auth.id)
                options.push('-p')
                options.push(this.auth.password)
            }
        }
        //TODO Use live binary callback and update progressbar //TODO
        // TODO Add more error handling
        try {
            return await this.start(this.url, args);
        } catch(exception) {
            console.log(exception);
            return exception;
        }
    }
}
module.exports = DownloadQuery;
