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

        if(!this.environment.settings.validateCertificate) {
            args.push("--no-check-certificate"); //Dont check the certificate if validate certificate is false
        }

        if(this.environment.settings.cookiePath != null) { //Add cookie arguments if enabled
            args.push("--cookies");
            args.push(this.environment.settings.cookiePath);
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
                console.error(e.stderr);
                this.environment.errorHandler.raiseUnhandledError("Please report this error.\n" + e.stderr, this.identifier);
                return "{}";
            }
        } else {
            //Return data while the query is running (live)
            //Return "close" when the query has finished
            return await new Promise((resolve) => {
                this.process = execa(command, args);
                this.process.stdout.setEncoding('utf8');
                this.process.stdout.on('data', (data) => {
                    cb(data.toString());
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
                    this.environment.errorHandler.checkError(data.toString(), this.identifier);
                    console.error(data.toString())
                })
            });
        }
    }

}
module.exports = Query;
