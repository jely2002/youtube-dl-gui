class ErrorHandler {
    constructor(win, queryManager) {
        this.queryManager = queryManager;
        this.win = win;
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
                code: "Possible broken extractor (404)",
                description: "YTDL isn't working, please wait for an update.",
                trigger: "HTTP Error 404"
            }
        ]
    }

    checkError(stderr, identifier) {
        for(const errorDef of this.errorDefinitions) {
            if(stderr.includes(errorDef.trigger)) {
                this.raiseError(errorDef, identifier)
                break;
            } else if(stderr.includes("ERROR")) {
                this.raiseUnhandledError(errorDef, identifier);
            }
        }
    }

    raiseUnhandledError(error, identifier) {
        console.log("raised unhandled error")
        let errorDef = {
            code: "Unhandled exception",
            description: error,
        }
        this.win.webContents.send("error", {error: errorDef, identifier: identifier, unexpected: true});
        this.queryManager.onError(identifier);
    }

    raiseError(errorDef, identifier) {
        console.log("raised error")
        this.win.webContents.send("error", {error: errorDef, identifier: identifier, unexpected: false});
        this.queryManager.onError(identifier);
    }

    reportError(error) {

    }

}

module.exports = ErrorHandler;
