const Utils = require("../Utils");
const path = require("path");

class Video {
    constructor(url, type, environment) {
        this.url = url;
        this.type = type;
        this.environment = environment;
        this.audioQuality = environment.mainAudioQuality;
        this.audioOnly = environment.mainAudioOnly;
        this.videoOnly = environment.mainVideoOnly;
        this.videoOnlySizeCache = [];
        this.downloadSubs = environment.mainDownloadSubs;
        this.subLanguages = [];
        this.selectedSubs = [];
        this.downloadingAudio = false;
        this.webpage_url = this.url;
        this.hasMetadata = false;
        this.downloaded = false;
        this.error = false;
        this.filename = null;
        this.identifier = Utils.getRandomID(32);
    }

    setFilename(liveData) {
        if(liveData.includes("[download] Destination: ")) {
            const replaced = liveData.replace("[download] Destination: ", "");
            this.filename = path.basename(replaced);
        } else if(liveData.includes("[ffmpeg] Merging formats into \"")) {
            const noPrefix = liveData.replace("[ffmpeg] Merging formats into \"", "");
            this.filename = path.basename(noPrefix.trim().slice(0, -1));
        } else if(liveData.includes("[ffmpeg] Adding metadata to '")) {
            const noPrefix = liveData.replace("[ffmpeg] Adding metadata to '", "");
            this.filename = path.basename(noPrefix.trim().slice(0, -1));
        }
    }

    getFilename() {
        if(this.hasMetadata) {
            let sanitizeRegex = /(?:[/<>:"|\\?*]|[\s.]$)/g;
            if(this.formats.length === 0) {
                const filename = this.title.substr(0, 200) + "-(p)"
                return filename.replace(sanitizeRegex, "_");
            } else {
                let fps = (this.formats[this.selected_format_index].fps != null) ? this.formats[this.selected_format_index].fps : "";
                let height = this.formats[this.selected_format_index].height;
                if(this.environment.settings.nameFormatMode === "%(title).200s-(%(height)sp%(fps).0d).%(ext)s") {
                    return (this.title.substr(0, 200) + "-(" + height + "p" + fps.toString().substr(0,2) + ")").replace(sanitizeRegex, "_");
                } else if(this.environment.settings.nameFormatMode !== "custom") {
                    return this.title.substr(0, 200).replace(sanitizeRegex, "_");
                }
            }
        }
    }

    setQuery(query) {
        this.query = query;
        //Set the download path when the video was downloaded
        this.environment.paths.validateDownloadPath().then(() => {
            this.downloadedPath = this.environment.settings.downloadPath;
        })
    }

    serialize() {
        let formats = [];
        for(const format of this.formats) {
            formats.push(format.serialize());
        }
        return {
            like_count: Utils.numberFormatter(this.like_count, 2),
            dislike_count: Utils.numberFormatter(this.dislike_count, 2),
            description: this.description,
            view_count: Utils.numberFormatter(this.view_count, 2),
            title: this.title,
            tags: this.tags,
            duration: this.duration,
            extractor: this.extractor,
            thumbnail: this.thumbnail,
            uploader: this.uploader,
            average_rating: this.average_rating,
            url: this.url,
            formats: formats
        };
    }

    setMetadata(metadata) {
        this.hasMetadata = true;
        this.like_count = metadata.like_count;
        this.dislike_count = metadata.dislike_count;
        this.average_rating = metadata.average_rating
        this.view_count = metadata.view_count;
        this.title = metadata.title;
        this.description = metadata.description;
        this.tags = metadata.tags;
        this.subtitles = metadata.subtitles;
        this.autoCaptions = metadata.automatic_captions;

        this.duration = metadata.duration;
        if(metadata.duration != null) this.duration = new Date(metadata.duration * 1000)
            .toISOString()
            .substr(11, 8);
        if(this.duration != null && this.duration.split(":")[0] === "00") this.duration = this.duration.substr(3);

        this.extractor = metadata.extractor_key;
        this.uploader = metadata.uploader;
        this.thumbnail = metadata.thumbnail;

        this.hasFilesizes = Utils.hasFilesizes(metadata)
        this.formats = Utils.parseAvailableFormats(metadata);
        this.audioCodecs = Utils.parseAvailableAudioCodecs(metadata);
        this.selected_format_index = this.selectHighestQuality();
    }

    selectHighestQuality() {
        this.formats.sort((a, b) => {
            return parseInt(b.height, 10) - parseInt(a.height, 10) || (a.fps == null) - (b.fps == null) || parseInt(b.fps, 10) - parseInt(a.fps, 10);
        });
        return 0;
    }

    getFormatFromLabel(formatLabel) {
        for(const format of this.formats) {
            if(format.getDisplayName() === formatLabel) {
                return format;
            }
        }
    }
}
module.exports = Video;
