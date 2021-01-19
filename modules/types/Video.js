const crypto = require('crypto');
const Utils = require("../Utils");

class Video {
    constructor(url, type, environment) {
        this.url = url;
        this.type = type;
        this.audioQuality = environment.mainAudioQuality;
        this.audioOnly = environment.mainAudioOnly;
        this.downloadSubs = environment.mainDownloadSubs;
        this.webpage_url = this.url;
        this.hasMetadata = false;
        this.identifier = crypto.randomBytes(16).toString("hex");
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

        this.duration = metadata.duration;
        if(metadata.duration != null) this.duration = new Date(metadata.duration * 1000).toISOString().substr(11, 8);
        if(this.duration != null && this.duration.split(":")[0] === "00") this.duration = this.duration.substr(3);

        this.extractor = metadata.extractor_key;
        this.uploader = metadata.uploader;
        this.thumbnail = metadata.thumbnail;

        this.formats = Utils.parseAvailableFormats(metadata);
        this.selected_format_index = this.selectHighestQuality();
    }

    selectHighestQuality() {
        this.formats.sort(function (a, b) {
            return parseInt(b.height) - parseInt(a.height) || parseInt(b.fps) - parseInt(a.fps);
        });
        return 0;
    }
}
module.exports = Video;
