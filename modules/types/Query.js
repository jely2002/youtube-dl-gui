const execa = require('execa');
const UserAgent = require('user-agents');
const Sentry = require("@sentry/node");

class Query {
    constructor(environment, identifier) {
        this.environment = environment;
        this.identifier = identifier
        this.process = null;
        this.stopped = false;
    }

    stop() {
        this.stopped = true;
        if(this.process != null) {
            this.process.cancel();
        }
    }

    async start(url, args, cb) {
        if(this.stopped) return "killed";
        args.push("--no-cache-dir");
        args.push("--ignore-config");

        if(this.environment.settings.userAgent === "spoof") {
            args.push("--user-agent"); //Add random user agent to slow down user agent profiling
            args.push(new UserAgent({ deviceCategory: 'desktop' }).toString());
        } else if(this.environment.settings.userAgent === "empty") {
            args.push("--user-agent");
            args.push("''"); //Add an empty user agent string to workaround VR video issues
        }

        if(this.environment.settings.proxy != null && this.environment.settings.proxy.length > 0) {
            args.push("--proxy");
            args.push(this.environment.settings.proxy);
        }

        if(!this.environment.settings.validateCertificate) {
            args.push("--no-check-certificate"); //Dont check the certificate if validate certificate is false
        }

        if(this.environment.settings.cookiePath != null) { //Add cookie arguments if enabled
            args.push("--cookies");
            args.push(this.environment.settings.cookiePath);
        }

        if(this.environment.settings.rateLimit !== "") {
            args.push("--limit-rate");
            args.push(this.environment.settings.rateLimit + "K");
        }

        if(this.environment.settings.noPlaylist) {
            args.push("--no-playlist");
        } else {
            args.push("--yes-playlist")
        }

        args.push(url) //Url must always be added as the final argument

        let command = this.environment.paths.ytdl; //Set the command to be executed

        if(this.environment.pythonCommand !== "python") { //If standard python is not available use another install if detected
            args.unshift(this.environment.paths.ytdl);
            command = this.environment.pythonCommand;
        }
        if(cb == null) {
            const transaction = Sentry.startTransaction({ name: "infoQuery" });
            const span = transaction.startChild({ op: "task" });
            //Return the data after the query has completed fully.
            try {
                const {stdout} = await execa(command, args);
                span.finish();
                transaction.finish();
                return stdout
            } catch(e) {
                if(!this.environment.errorHandler.checkError(e.stderr, this.identifier)) {
                    if(!this.environment.errorHandler.checkError(e.shortMessage, this.identifier)) {
                        this.environment.errorHandler.raiseUnhandledError("Unhandled error (execa)", JSON.stringify(e, null, 2), this.identifier);
                    }
                }
                span.finish();
                transaction.finish();
                return "{}";
            }
        } else {
            const transaction = Sentry.startTransaction({ name: "liveQuery" });
            const span = transaction.startChild({ op: "task" });
            //Return data while the query is running (live)
            //Return "done" when the query has finished
            return await new Promise((resolve) => {
                this.process = execa(command, args);
                this.process.stdout.setEncoding('utf8');
                this.process.stdout.on('data', (data) => {
                    cb(data.toString());
                });
                this.process.stdout.on('close', () => {
                    if(this.process.killed) {
                        transaction.setTag("result", "killed");
                        span.finish();
                        transaction.finish();
                        cb("killed");
                        resolve("killed");
                    }
                    transaction.setTag("result", "done");
                    span.finish();
                    transaction.finish();
                    cb("done");
                    resolve("done");
                });
                this.process.stderr.on("data", (data) => {
                    cb(data.toString());
                    if(this.environment.errorHandler.checkError(data.toString(), this.identifier)) {
                        cb("killed");
                        resolve("killed");
                        transaction.setTag("result", "killed");
                        span.finish();
                        transaction.finish();
                    }
                    console.error(data.toString())
                })
            });
        }
    }

}
module.exports = Query;
