const Query = require("../types/Query");

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
}
module.exports = InfoQuery;
