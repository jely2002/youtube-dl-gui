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

}
module.exports = Utils;
