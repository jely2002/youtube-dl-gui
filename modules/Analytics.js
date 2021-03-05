const axios = require("axios");
const querystring = require("querystring");
const Utils = require("./Utils");

class Analytics {
    constructor(version, paths, settings) {
        this.paths = paths;
        this.version = version;
        this.settings = settings;
    }

    sendDownload() {
        if(!this.settings.statSend) {
            axios.post('http://backend.jelleglebbeek.com/youtubedl/download.php/', querystring.stringify({ version: this.version })).then(() => {
                this.settings.statSend = true;
                this.settings.save()
            });
        }
    }

    async sendReport(err) {
        const id = Utils.getRandomID(8);
        await axios.post('http://backend.jelleglebbeek.com/youtubedl/errorreport.php/', querystring.stringify({ id: id, version: this.version, code: err.error.code, description: err.error.description, platform: process.platform, url: err.url, type: err.type, quality: err.quality}));
        return id;
    }
}

module.exports = Analytics;
