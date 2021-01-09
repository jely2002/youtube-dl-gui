const Query = require("./Query");

class FormatQuery extends Query {
    constructor(url, formatString, environment, auth, progressBar) {
        super(environment, auth, progressBar);
        this.url = url;
        this.formatString = formatString;
    }

    async connect() {
        return await this.start(this.url, ["-J", "--skip-download", this.formatString]);
    }
}
