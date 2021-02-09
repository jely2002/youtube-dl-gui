const execa = require('execa');

class Query {
    constructor(environment) {
        this.environment = environment;
        this.process = null;
    }

    stop() {
        this.process.cancel();
    }

    async start(url, args, cb) {
        args.push("--no-cache-dir")
        if(this.environment.cookiePath != null) { //Add cookie arguments if enabled
            args.push("--cookies");
            args.push(this.environment.cookiePath);
        }
        args.push(url) //Url must always be added as the final argument
        if(cb == null) {
            //Return the data after the query has completed fully.
            const {stdout} = await execa(this.environment.paths.ytdl, args);
            return stdout
        } else {
            //Return data while the query is running (live)
            //Return "close" when the query has finished
            await new Promise((resolve, reject) => {
                this.process = execa(this.environment.paths.ytdl, args);
                this.process.stdout.setEncoding('utf8');
                this.process.stdout.on('data', (data) => {
                    cb(data.toString());
                });
                this.process.stdout.on('close', (code) => {
                    cb("close");
                    resolve("close");
                });
                this.process.stderr.on("data", (data) => {
                    console.log(data.toString())
                })
            });
        }
    }

}
module.exports = Query;
