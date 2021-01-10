const Query = require("./Query");
const Utils = require("./Utils");
const Format = require("./Format");

class InfoQuery extends Query {
    constructor(url, environment, auth, progressBar) {
        super(environment, auth, progressBar);
        this.url = url;
    }

    async connect() {
       // if(Utils.isYouTubeChannel(this.url)) { TODO FIX YOUTUBE/VIMEO CHANNELS
       //     //TODO Move channel detection and sanitization one level higher
       //     let channelVideoUrl = Utils.sanitizeYouTubeChannel(this.url) + "/videos";
        //    return await this.start(channelVideoUrl, ["-J", "--flat-playlist"]);
       // } else {
            try {
                return await this.start(this.url, ["-J", "--flat-playlist"]);
            } catch (e) {
                if(e.stderr.includes("Unsupported URL")) { // TODO Add more error handling
                    console.log(`The url: ${this.url}, is not supported by youtube-dl.`);
                    return null;
                } else  {
                    console.log(e)
                }
            }
      //  }
    }

    parseVideoMetadata(metadata) {
        let videoData = {};
        videoData.like_count = metadata.like_count;
        videoData.dislike_count = metadata.dislike_count;
        videoData.view_count = metadata.view_count;
        videoData.extractor = metadata.extractor_key;
        videoData.title = metadata.title;
        videoData.description = metadata.description;
        videoData.tags = metadata.tags;
        videoData.average_rating = metadata.average_rating

        videoData.duration = metadata.duration;
        if(metadata.duration != null) videoData.duration = new Date(metadata.duration * 1000).toISOString().substr(11, 8);
        if(videoData.duration != null && videoData.duration.split(":")[0] === "00") videoData.duration = videoData.duration.substr(3);

        videoData.uploader = metadata.uploader;
        videoData.thumbnail = metadata.thumbnail;
        return videoData;
    }


    parseAvailableFormats(metadata) {
        let formats = [];
        let detectedFormats = [];
        for(let dataFormat of metadata.formats) {
            if(dataFormat.height == null) continue;
            let format = new Format(dataFormat.height, dataFormat.fps, null, null);
            if(!detectedFormats.includes(format.getDisplayName())) {
                formats.push(format);
                detectedFormats.push(format.getDisplayName());
            }
        }
        return formats;
        //See the UML file about getting format data.
        //It basically parses the metadata from the connect() into data that can be put into the format selector.
        //Formats can only be parsed if ALL video formats contain: height, extension (ext). And if ALL audio formats contain an extension.
    }
}
module.exports = InfoQuery;
