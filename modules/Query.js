const childProcess = require('child_process');
const execa = require('execa');

class Query {
    constructor(environment, auth, progressBar) {
        this.environment = environment;
        this.auth = auth;
        this.progressBar = progressBar;
    }
    isAuthUsed() {
        if(this.auth == null) return false;
        return this.auth.id != null;
    }
    async start(url, args, cb) {
        args.push("--no-cache-dir")
        args.push(url) //Url must always be added as the final argument
        if(cb == null) {
            //Return the data after the query has completed fully.
            const {stdout} = await execa(this.environment.ytdlBinary, args);
            return stdout
        } else {
            //Return data while the query is running (live)
            //Return "close" when the query has finished
            await new Promise((resolve, reject) => {
                let process = execa(this.environment.ytdlBinary, args);
                process.stdout.setEncoding('utf8');
                process.stdout.on('data', (data) => {
                    cb(data.toString());
                });
                process.stdout.on('close', (code) => {
                    cb("close")
                    resolve("close")
                });
            });
        }
    }

}
module.exports = Query;
