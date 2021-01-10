const Query = require("./Query");
const Utils = require("./Utils");
const Format = require("./Format");

class InfoQuery extends Query {
    constructor(url, environment, progressBar) {
        super(environment, progressBar);
        this.url = url;
        this.environment = environment;
    }

    async connect() {
        //TODO FIX/IMPLEMENT CHANNELS
        try {
            let args = ["-J", "--flat-playlist"]
            if(this.environment.cookiePath != null) {
                args.push("--cookies");
                args.push(this.environment.cookiePath);
            }
            let data = await this.start(this.url, args);
            return JSON.parse(data);
        } catch (e) {
            if(e.stderr != null && e.stderr.includes("Unsupported URL")) { // TODO Add more error handling
                console.log(`The url: ${this.url}, is not supported by youtube-dl.`);
                return null;
            } else  {
                console.log(e)
            }
        }
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
    }
}
module.exports = InfoQuery;
