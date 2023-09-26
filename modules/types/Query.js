const execa = require('execa');
const UserAgent = require('user-agents');

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
            //Return the data after the query has completed fully.
            try {
                const {stdout} = await execa(command, args);
                return stdout
            } catch(e) {
                if(!this.environment.errorHandler.checkError(e.stderr, this.identifier)) {
                    if(!this.environment.errorHandler.checkError(e.shortMessage, this.identifier)) {
                        this.environment.errorHandler.raiseUnhandledError("Unhandled error (execa)", JSON.stringify(e, null, 2), this.identifier);
                    }
                }
                return "{}";
            }
        } else {
            //Return data while the query is running (live)
            //Return "done" when the query has finished
            return await new Promise((resolve) => {
                this.process = execa(command, args);
                this.process.stdout.setEncoding('utf8');
                this.process.stdout.on('data', (data) => {
                    const lines = data
                        .toString()
                        .replace(/\\u[0-9A-Fa-f]{4}/g, escapedUnicode => String.fromCharCode(parseInt(escapedUnicode.slice(2), 16)))
                        .split("\n");
                    for(const line of lines) {
                        cb(line);
                    }
                });
                this.process.stdout.on('close', () => {
                    if(this.process.killed) {
                        cb("killed");
                        resolve("killed");
                    }
                    cb("done");
                    resolve("done");
                });
                this.process.stderr.on("data", (data) => {
                    cb(data.toString());
                    if(this.environment.errorHandler.checkError(data.toString(), this.identifier)) {
                        cb("killed");
                        resolve("killed");
                    }
                    console.error(data.toString())
                })
            });
        }
    }

}
module.exports = Query;
