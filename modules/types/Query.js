const execa = require('execa');
const UserAgent = require('user-agents');

class Query {
    constructor(environment, identifier) {
        this.environment = environment;
        this.identifier = identifier
        this.process = null;
    }

    stop() {
        this.process.cancel();
    }

    async start(url, args, cb) {
        args.push("--no-cache-dir");

        if(this.environment.settings.spoofUserAgent) {
            args.push("--user-agent"); //Add random user agent to slow down user agent profiling
            args.push(new UserAgent().toString());
        }

        if(this.environment.settings.cookiePath != null) { //Add cookie arguments if enabled
            args.push("--cookies");
            args.push(this.environment.settings.cookiePath);
        }
        args.push(url) //Url must always be added as the final argument
        if(cb == null) {
            //Return the data after the query has completed fully.
            try {
                const {stdout} = await execa(this.environment.paths.ytdl, args);
                return stdout
            } catch(e) {
                this.environment.errorHandler.checkError(e.stderr, this.identifier);
                return "{}";
            }
        } else {
            //Return data while the query is running (live)
            //Return "close" when the query has finished
            return await new Promise((resolve, reject) => {
                this.process = execa(this.environment.paths.ytdl, args);
                this.process.stdout.setEncoding('utf8');
                this.process.stdout.on('data', (data) => {
                    cb(data.toString());
                });
                this.process.stdout.on('close', (code) => {
                    if(this.process.killed) {
                        cb("killed");
                        resolve("killed");
                    }
                    cb("done");
                    resolve("done");
                });
                this.process.stderr.on("data", (data) => {
                    this.environment.errorHandler.checkError(data.toString(), this.identifier);
                    console.error(data.toString())
                })
            });
        }
    }

}
module.exports = Query;
