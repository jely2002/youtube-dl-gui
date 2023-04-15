const Query = require("../types/Query");

class InfoQuery extends Query {
    constructor(url, identifier, environment) {
        super(environment, identifier);
        this.url = url;
        this.environment = environment;
        this.identifier = identifier;
    }

    async connect() {
        try {
            let args = ["-J", "--flat-playlist"]
            if(this.environment.settings.fileAccessRetries) {
                args.push('--file-access-retries');
                args.push(this.environment.settings.fileAccessRetries);
            }
            let data = await this.environment.metadataLimiter.schedule(() => this.start(this.url, args));
            return JSON.parse(data);
        } catch (e) {
            this.environment.errorHandler.checkError(e.stderr, this.identifier)
            return null;
        }
    }
}
module.exports = InfoQuery;
