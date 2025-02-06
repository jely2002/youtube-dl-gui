const Query = require("../types/Query")
const path = require('path')
const fs = require('fs');
const Utils = require("../Utils")
const console = require('console');

class DownloadQuery extends Query {
    constructor(video, progressBar, playlistMeta) {
        super(video.environment, video.identifier);
        this.playlistMeta = playlistMeta;
        this.video = video;
        this.progressBar = progressBar;
        this.format = video.formats[video.selected_format_index];
    }

    cancel() {
        super.stop();
    }

    createYDLArguments(){
        let args = [];
        let downloadFolderPath = this.environment.settings.downloadPath;
        const PROGRESS_TEMPLATE = '[download] %(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s %(progress)j';
        if (this.environment.settings.avoidFailingToSaveDuplicateFileName) {
            downloadFolderPath += `/[${this.video.identifier}]`;
        }
        let output = path.join(downloadFolderPath, Utils.resolvePlaylistPlaceholders(this.environment.settings.nameFormat, this.playlistMeta));

        if (this.video.audioOnly) {
            let audioQuality = this.video.audioQuality;
            if (audioQuality === "best") {
                audioQuality = "0";
            } else if (audioQuality === "worst") {
                audioQuality = "9";
            }
            const audioOutputFormat = this.environment.settings.audioOutputFormat;
            args = [
                '--extract-audio', '--audio-quality', audioQuality,
                '--ffmpeg-location', this.environment.paths.ffmpeg,
                '--no-mtime',
                '-o', output,
                '--output-na-placeholder', "",
                '--progress-template', PROGRESS_TEMPLATE
            ];
            if (this.video.selectedAudioEncoding !== "none") {
                args.push("-f");
                args.push("bestaudio[acodec=" + this.video.selectedAudioEncoding + "]/bestaudio");
            } else if (audioOutputFormat === "m4a") {
                args.push("-f");
                args.push("bestaudio[ext=m4a]/bestaudio");
            }
            if (audioOutputFormat !== "none") {
                args.push('--audio-format', audioOutputFormat);
            }
            if (audioOutputFormat === "m4a" || audioOutputFormat === "mp3" || audioOutputFormat === "none") {
                args.push("--embed-thumbnail");
            }
        } else {
            if (this.video.formats.length !== 0) {
                let format;
                const encoding = this.video.selectedEncoding === "none" ? "" : "[vcodec=" + this.video.selectedEncoding + "]";
                const audioEncoding = this.video.selectedAudioEncoding === "none" ? "" : "[acodec=" + this.video.selectedAudioEncoding + "]";
                if (this.video.videoOnly) {
                    format = `
                    bestvideo[height=${this.format.height}][fps=${this.format.fps}][ext=mp4]${encoding}
                    /bestvideo[height=${this.format.height}][fps=${this.format.fps}]${encoding}
                    /bestvideo[height=${this.format.height}][fps=${this.format.fps}]
                    /bestvideo[height=${this.format.height}]
                    /best[height=${this.format.height}]
                    /bestvideo
                    /best`;
                    if (this.format.fps == null) {
                        format = `
                        bestvideo[height=${this.format.height}][ext=mp4]${encoding}
                        /bestvideo[height=${this.format.height}]${encoding}
                        /bestvideo[height=${this.format.height}]
                        /best[height=${this.format.height}]
                        /bestvideo
                        /best`
                    }
                } else {
                    format = `
                    bestvideo[height=${this.format.height}][fps=${this.format.fps}][ext=mp4]${encoding}+${this.video.audioQuality}audio[ext=m4a]${audioEncoding}
                    /bestvideo[height=${this.format.height}][fps=${this.format.fps}]${encoding}+${this.video.audioQuality}audio${audioEncoding}
                    /bestvideo[height=${this.format.height}][fps=${this.format.fps}]${encoding}+${this.video.audioQuality}audio
                    /bestvideo[height=${this.format.height}][fps=${this.format.fps}]+${this.video.audioQuality}audio
                    /bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio
                    /best[height=${this.format.height}]
                    /bestvideo+bestaudio
                    /best`;
                    if (this.format.fps == null) {
                        format = `
                        bestvideo[height=${this.format.height}][ext=mp4]${encoding}+${this.video.audioQuality}audio[ext=m4a]${audioEncoding}
                        /bestvideo[height=${this.format.height}]${encoding}+${this.video.audioQuality}audio${audioEncoding}
                        /bestvideo[height=${this.format.height}]${encoding}+${this.video.audioQuality}audio
                        /bestvideo[height=${this.format.height}]+${this.video.audioQuality}audio
                        /best[height=${this.format.height}]
                        /bestvideo+bestaudio
                        /best`
                    }
                }
                args = [
                    "-f", format,
                    "-o", output,
                    '--ffmpeg-location', this.environment.paths.ffmpeg,
                    '--no-mtime',
                    '--output-na-placeholder', "",
                    '--progress-template', PROGRESS_TEMPLATE
                ];
            } else {
                args = [
                    "-o", output,
                    '--ffmpeg-location', this.environment.paths.ffmpeg,
                    '--no-mtime',
                    '--output-na-placeholder', "",
                    '--progress-template', PROGRESS_TEMPLATE
                ];
            }
            if (this.video.downloadSubs && this.video.subLanguages.length > 0) {
                this.progressBar.setInitial("Downloading subtitles");
                args.push("--write-sub");
                args.push("--write-auto-sub");
                args.push("--embed-subs");
                args.push("--sub-lang");
                let langs = "";
                this.video.subLanguages.forEach(lang => langs += lang + ",")
                args.push(langs.slice(0, -1));
            }
            if (this.environment.settings.outputFormat !== "none") {
                args.push("--merge-output-format");
                args.push(this.environment.settings.outputFormat);
            }
        }

        if (this.environment.settings.downloadMetadata) {
            args.push('--add-metadata');
        }
        if (this.environment.settings.downloadThumbnail) {
            args.push('--write-thumbnail');
        }
        if (this.environment.settings.sponsorblockMark !== "") {
            args.push("--sponsorblock-mark");
            args.push(this.environment.settings.sponsorblockMark);
        }

        if (this.environment.settings.sponsorblockRemove !== "") {
            args.push("--sponsorblock-remove");
            args.push(this.environment.settings.sponsorblockRemove);
        }

        if (this.environment.settings.keepUnmerged || this.environment.settings.avoidFailingToSaveDuplicateFileName) {
            args.push('--keep-video');
        }

        if (this.environment.settings.retries) {
            args.push('--retries');
            args.push(this.environment.settings.retries);
        }

        if(this.environment.settings.allowUnsafeFileExtensions) {
            args.push('--compat-options','allow-unsafe-ext');
        }

        if(this.environment.settings.allowUnplayable) {
            args.push('--allow-unplayable-formats');
        }
        this.video.headers.forEach((h) => args.push("--add-headers", h.k + ": " + h.v));

        return args;
    }

    createFfmpegArguments(){
        let args = [];
        let downloadFolderPath = this.environment.settings.downloadPath;
        if (this.environment.settings.avoidFailingToSaveDuplicateFileName) {
            downloadFolderPath += `/[${this.video.identifier}]`;
        }
        let output = path.join(downloadFolderPath, this.video.getFilename());
        let ffversion = require('child_process').execSync(path.join(this.environment.paths.ffmpeg,"ffmpeg"+(process.platform=='win32'?'.exe':''))+' -version')
        ffversion = ffversion.toString();
        ffversion = ffversion.substring(ffversion.indexOf('version')+8,ffversion.indexOf('Copyright'))

        let isFFmpeg7=false;
        if(ffversion.match(/(7)/g)) isFFmpeg7=true;

        let ffmpegheads = '';
        this.video.headers.forEach((h) => {
            if (h.k.toLowerCase() == 'referer') {
                args.push("-referer", h.v);
            } else {
                if(isFFmpeg7) ffmpegheads = ffmpegheads + h.k + ": " + h.v + '\r\n'; //Ffmpeg7 syntax ffmpeg 6 takes separate headers options
                else  args.push("-headers", h.k + ": " + h.v)
            }
        });

        if (ffmpegheads != '') args.push("-headers",ffmpegheads)

        args.push("-i", this.video.url);
        let formatid = this.video.formats.findIndex(e => e.height == this.format.height)

        args.push('-c','copy');

        args.push('-map','0:'+this.video.formats[formatid].format_index)

        if(this.environment.settings.allowUnplayable||this.environment.settings.keepUnmerged) {
            //Keep stream files separated
            args.push(output+"_video.mp4");
            args.push('-map','0:a:0'); //First audio track found...
            args.push(output+"_audio.aac");
        } else {
            args.push('-map','0:a:0'); //First audio track found....
            args.push(output+".mp4");
        }
        return args;
    }

    async connect() {
        let downloadFolderPath = this.environment.settings.downloadPath;

        if (this.environment.settings.avoidFailingToSaveDuplicateFileName) {
            downloadFolderPath += `/[${this.video.identifier}]`;
        }

        let args = [];
        let useFfmpeginsteadofYDL = this.video.is_live && this.video.extractor == 'Generic';

        if (useFfmpeginsteadofYDL) args = this.createFfmpegArguments()
        else args = this.createYDLArguments()

        console.log(args);

        let destinationCount = 0;
        let initialReset = false;
        let result = null;
        const regexliverec = /size=\s*(\d+\w)i*B\s*time=(\d+:\d+:\d+.\d+)\s*bitrate=\s*(\d+.\d+\w)bits\/s\s*speed=\d+.\d+x/;
        try {
            result = await this.environment.downloadLimiter.schedule(() => this.start(this.video, args, (liveData) => {
                this.environment.logger.log(this.video.identifier, liveData);
                this.video.setFilename(liveData);
                if (this.video.is_live) {
                    if (!initialReset) {
                        initialReset = true;
                        this.progressBar.reset();
                        return;
                    }
                    try {
                        const livrec = liveData.match(regexliverec);
                        if (typeof (`${livrec[1]}`) == "undefined") return;
                        this.progressBar.updateDownload('livestream', `${livrec[2]}`, `${livrec[3]}bits/s`, this.video.audioOnly || this.video.downloadingAudio);
                    } catch (e) {
                        return;
                    }
                    return;
                }
                let livrec=null;
                try{
                    livrec =  liveData.match(regexliverec);
                    if (typeof (`${livrec[1]}`) == "undefined") return;
                    this.progressBar.updateDownload('livestream', `${livrec[2]}`, `${livrec[3]}bits/s`, this.video.audioOnly || this.video.downloadingAudio);
                }catch(e){
                   //
                }
                if (livrec!=null) return;
                if (!liveData.includes("[download]")) return;

                if (liveData.includes("Destination")) destinationCount += 1;

                if (!initialReset) {
                    initialReset = true;
                    this.progressBar.reset();
                    return;
                }

                if (destinationCount === 2 && !this.video.audioOnly && !this.video.downloadingAudio) {
                    this.video.downloadingAudio = true;
                    this.progressBar.reset();
                    return;
                }

                let liveDataObj;
                try {
                    liveDataObj = JSON.parse(liveData.slice(liveData.indexOf('{')));
                } catch (e) {
                    return;
                }

                let percentage;
                if ("fragment_count" in liveDataObj) {
                    //When there is multiple fragments, cap the completion percentage to avoid some strange values.
                    const completion = Math.min(
                        liveDataObj.downloaded_bytes / liveDataObj.total_bytes_estimate,
                        (liveDataObj.fragment_index + 1) / liveDataObj.fragment_count
                    );
                    percentage = Math.floor(completion * 100) + "." + (Math.floor(completion * 1000) % 10) + "%";
                } else {
                    percentage = liveDataObj._percent_str;
                }

                const speed = liveDataObj._speed_str;
                const eta = liveDataObj.eta >= 0 ? liveDataObj._eta_str : "00:00";

                this.progressBar.updateDownload(percentage, eta, speed, this.video.audioOnly || this.video.downloadingAudio);
            }));
        } catch (exception) {
            this.environment.errorHandler.checkError(exception, this.video.identifier);
            return exception;
        }

        if (this.video.audioOnly) {
            await this.removeThumbnail(".jpg");
        }

        if (this.environment.settings.avoidFailingToSaveDuplicateFileName) {
            this.environment.paths.moveFile(downloadFolderPath, this.environment.settings.downloadPath, this.video.getFilename());

            if (!this.environment.settings.keepUnmerged) {
                this.removeVideoDataFolder(downloadFolderPath);
            }
        }

        return result;
    }

    async removeThumbnail(extension) {
        const filename = this.video.filename;
        if (filename != null) {
            const filenameExt = path.basename(filename, path.extname(filename)) + extension;
            const filenameAbs = path.join(this.video.downloadedPath, filenameExt);
            try {
                await fs.promises.unlink(filenameAbs);
            } catch (e) {
                console.log("No left-over thumbnail found to remove. (" + filenameExt + ")")
                if (extension !== ".webp") {
                    await this.removeThumbnail(".webp");
                }
            }
        }
    }

    removeVideoDataFolder(folderPath) {
        if (folderPath != null) {
            try {
                fs.rmSync(folderPath, { recursive: true, force: true });
            } catch (e) {
                console.log("No left-over Temp Folder found to remove. (" + folderPath + ")")
            }
        }
    }
}
module.exports = DownloadQuery;
