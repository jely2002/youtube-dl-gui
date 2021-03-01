class ErrorHandler {
    constructor(win, queryManager, env) {
        this.env = env;
        this.queryManager = queryManager;
        this.win = win;
        this.unhandledErrors = [];
        this.errorDefinitions = [
            {
                code: "No authentication",
                description: 'Authenticate using&nbsp;<span onclick="$(\'#authModal\').modal(\'show\');" class="openAuth">cookies</span>&nbsp;and try again.',
                trigger: "ERROR: Private video"
            },
            {
                code: "No connection could be made",
                description: "The host or your internet connection is down.",
                trigger: "getaddrinfo failed"
            },
            {
                code: "URL not supported",
                description: "This URL is currently not supported by YTDL.",
                trigger: "is not a valid URL"
            },
            {
                code: "URL not supported",
                description: "This URL is currently not supported by YTDL.",
                trigger: "Unsupported URL"
            },
            {
                code: "Possible broken extractor (404)",
                description: "YTDL isn't working, please wait for an update.",
                trigger: "HTTP Error 404"
            },
            {
                code: "Private or removed video",
                description: "This video can not be extracted.",
                trigger: "metadata.formats is not iterable"
            },
            {
                code: "ffmpeg not found",
                description: "Format merging requires ffmpeg.",
                trigger: "ffmpeg"
            }
        ]
    }

    checkError(stderr, identifier) {
        for(const errorDef of this.errorDefinitions) {
            if(stderr.includes(errorDef.trigger)) {
                if(errorDef.code === "ffmpeg not found" && process.argv[2] === '--dev') break; //Do not raise a 'ffmpeg not found' error when in dev mode
                this.raiseError(errorDef, identifier);
                break;
            } else if(stderr.includes("ERROR")) {
                this.raiseUnhandledError(stderr, identifier);
                break;
            }
        }
    }

    raiseUnhandledError(error, identifier) {
        if(!this.isSingleVideo(identifier)) return;
        console.log("raised unhandled error")
        let errorDef = {
            identifier: identifier,
            unexpected: true,
            error: {
                code: "Unhandled exception",
                description: error,
            }
        };
        this.win.webContents.send("error", errorDef);
        this.unhandledErrors.push(errorDef);
        this.queryManager.onError(identifier);
    }

    raiseError(errorDef, identifier) {
        console.log("raised error")
        this.win.webContents.send("error", { error: errorDef, identifier: identifier, unexpected: false });
        this.queryManager.onError(identifier);
    }


    isSingleVideo(identifier) {
        return this.queryManager.getVideo(identifier).type === "single";
    }

    async reportError(identifier) {
        for(const err of this.unhandledErrors) {
            if(err.identifier === identifier) {
                return await this.env.analytics.sendReport(err);
            }
        }
    }
}

module.exports = ErrorHandler;
