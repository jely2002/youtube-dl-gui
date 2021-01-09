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

}
module.exports = Utils;
