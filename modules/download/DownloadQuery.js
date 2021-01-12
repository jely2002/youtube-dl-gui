const Query = require("../types/Query")
const path = require("path")

class DownloadQuery extends Query {
    constructor(url, video, environment, progressBar) {
        super(environment, progressBar);
        this.url = url;
        this.video = video;
        this.format = video.formats[video.selected_format_index];
        console.log(this.format)
    }

    async connect() {
        let args;
        if(this.video.audioOnly) {
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
            let format = `bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.format.audioQuality}audio[ext=m4a]/bestvideo[height=${this.format.height}]+${this.format.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`;
            if(this.format.fps == null) {
                format = `bestvideo[height=${this.format.height}]+${this.format.audioQuality}audio/best[height=${this.format.height}]/bestvideo+bestaudio/best`
            }
            args = [
                "-f", format,
                "-o", output,
                '--ffmpeg-location', this.environment.ffmpegBinary, '--hls-prefer-ffmpeg',
                '--no-mtime',
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
        //TODO update progressbar //TODO
        // TODO Add more error handling
        try {
            await this.start(this.url, args, (liveData) => {
                if(!liveData.includes("[download]")) return;
                let liveDataArray = liveData.split(" ").filter((el) => { return el !== "" });
                if(liveDataArray.length > 8) return;
                let percentage = liveDataArray[1];
                let speed = liveDataArray[5];
                let eta = liveDataArray[7];
                if(percentage === "100%") {
                    console.log("Finishing up...");
                    return;
                    //Set progressbar to Finishing up.. and update
                }
                console.log(percentage + " | " + speed + " - ETA " + eta);
            })
        } catch(exception) {
            console.log(exception);
            return exception;
        }
    }
}
module.exports = DownloadQuery;
