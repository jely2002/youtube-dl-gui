class Video {
    constructor(url, formats, metadata, environment) {
        this.url = url;
        this.audioQuality = environment.mainAudioQuality;
        this.audioOnly = environment.mainAudioOnly;
        this.downloadSubs = environment.mainDownloadSubs;
        this.formats = formats;
        this.webpage_url = this.url;
        this.like_count = metadata.like_count;
        this.dislike_count = metadata.dislike_count;
        this.average_rating = metadata.average_rating
        this.view_count = metadata.view_count;
        this.title = metadata.title;
        this.description = metadata.description;
        this.tags = metadata.tags;
        this.selected_format_index = formats.length - 1; //Automatically select the highest format

        this.duration = metadata.duration;
        if(metadata.duration != null) this.duration = new Date(metadata.duration * 1000).toISOString().substr(11, 8);
        if(this.duration != null && this.duration.split(":")[0] === "00") this.duration = this.duration.substr(3);

        this.extractor = metadata.extractor_key;
        this.uploader = metadata.uploader;
        this.thumbnail = metadata.thumbnail;
    }
}
module.exports = Video;
