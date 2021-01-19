const Format = require("./types/Format");
const channelRegex = /(?:https|http)\:\/\/(?:[\w]+\.)?youtube\.com\/(?:c\/|channel\/|user\/)?([a-zA-Z0-9\-]{1,})/;

class Utils {

    static isYouTubeChannel(url) {
        return channelRegex.test(url);
    }

    static sanitizeYouTubeChannel(url) {
        if (channelRegex.test(url)) {
            return url.match(channelRegex)[0]
        } else {
            return url;
        }
    }

    static convertBytes(bytes) {
        const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let l = 0, n = parseInt(bytes, 10) || 0;
        while(n >= 1024 && ++l){
            n = n/1024;
        }
        return(n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
    }

    static extractPlaylistUrls(infoQueryResult) {
        let urls = [];
        let alreadyDone = [];
        if(infoQueryResult.entries == null || infoQueryResult.entries.length === 0) {
            console.error("Cannot extract URLS, no entries in data.")
            return [urls, alreadyDone];
        }
        for(const entry of infoQueryResult.entries) {
            let url;
            if (entry.url == null) url = entry.webpage_url;
            else url = (entry.ie_key != null && entry.ie_key === "Youtube") ? "https://youtube.com/watch?v=" + entry.url : entry.url;
            if(entry.formats != null && entry.formats.length > 0) {
                entry.url = url;
                alreadyDone.push(entry);
                continue;
            }
            urls.push(url);
        }
        return [urls, alreadyDone]
    }

    static detectInfoType(infoQueryResult) {
        if (infoQueryResult._type != null && infoQueryResult._type === "playlist") return "playlist";
        if (infoQueryResult.entries != null && infoQueryResult.entries > 0) return "playlist";
        return "single";
    }

    static parseAvailableFormats(metadata) {
        let formats = [];
        let detectedFormats = [];
        for(let dataFormat of metadata.formats) {
            if(dataFormat.height == null) continue;
            let format = new Format(dataFormat.height, dataFormat.fps, null);
            if(!detectedFormats.includes(format.getDisplayName())) {
                formats.push(format);
                detectedFormats.push(format.getDisplayName());
            }
        }
        return formats;
    }
}
module.exports = Utils;
