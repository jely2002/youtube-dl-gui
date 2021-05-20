class ErrorHandler {
    constructor(win, queryManager, env) {
        this.env = env;
        this.queryManager = queryManager;
        this.win = win;
        this.unhandledErrors = [];
        this.errorDefinitions = [
            {
                code: "No authentication",
                description: `Authenticate using&nbsp;<span onclick="$('#authModal').modal('show');" class="openAuth">cookies</span>&nbsp;and try again.`,
                trigger: "ERROR: Private video"
            },
            {
                code: "No authentication",
                description: `Authenticate using&nbsp;<span onclick="$('#authModal').modal('show');" class="openAuth">cookies</span>&nbsp;and try again.`,
                trigger: "ERROR: This video is only available for registered users"
            },
            {
                code: "Members-only content",
                description: `Authenticate using&nbsp;<span onclick="$('#authModal').modal('show');" class="openAuth">cookies</span>&nbsp;and try again.`,
                trigger: "ERROR: Join this channel to get access to members-only content"
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
              code: "Private or non-existent playlist",
              description: `This playlist does not exist or is&nbsp;<span onclick="$('#authModal').modal('show');" class="openAuth">private</span>.`,
              trigger: "ERROR: The playlist does not exist"
            },
            {
                code: "Age restricted video",
                description: `To download this video log-in using &nbsp;<span onclick="$('#authModal').modal('show');" class="openAuth">cookies</span>.`,
                trigger: "ERROR: Sign in to confirm your age"
            },
            {
                code: "Embed-only video",
                description: "Try using the URL of the embed page.",
                trigger: "ERROR: Cannot download embed-only video without embedding URL"
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
                trigger: "ffmpeg or avconv not found"
            },
            {
                code: "ffmpeg not found",
                description: "Transcoding to mp3 or mp4 requires ffmpeg.",
                trigger: "ffmpeg or avconv could not be found"
            },
            {
                code: "ffmpeg not found",
                description: "Transcoding to mp3 or mp4 requires ffmpeg.",
                trigger: "ffprobe/avprobe and ffmpeg/avconv not found"
            },
            {
                code: "Incomplete video ID",
                description: "The URL you entered is incomplete.",
                trigger: "Incomplete YouTube ID"
            },
            {
                code: "Too many requests (429)",
                description: "You are being ratelimited by the service.",
                trigger: "HTTP Error 429"
            },
            {
                code: "Unable to extract initial data",
                description: "Please do try again in a moment.",
                trigger: "ERROR: Unable to extract yt initial data"
            },
            {
                code: "No write permission",
                description: "No write permission in download folder.",
                trigger: "[Errno 95]"
            },
            {
                code: "SSL verification failed",
                description: "Disable the 'Validate HTTPS certificates' setting.",
                trigger: "<urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed"
            },
            {
                code: "Max fragment retries reached",
                description: "The service did not respond in time.",
                trigger: "giving up after 10 fragment retries"
            },
            {
                code: "Connection timed out",
                description: "Please try again in a moment.",
                trigger: "EOF occurred in violation of protocol"
            },
            {
                code: "Connection timed out",
                description: "Please try again in a moment.",
                trigger: "[Errno 60]"
            },
            {
                code: "No connection could be made",
                description: "Check your proxy and internet connection.",
                trigger: "[WinError 10060]"
            },
            {
                code: "Connection reset",
                description: "The connection was closed by the remote host.",
                trigger: "[WinError 10054]"
            },
            {
                code: "File in use by another process",
                description: "Don't open the file while it's downloading.",
                trigger: "[WinError 32]"
            },
            {
                code: "Binaries missing/corrupted",
                description: "Please restart the app, or disable antivirus.",
                trigger: "Command failed with ENOENT: resources\\app.asar.unpacked\\binaries\\youtube-dl.exe"
            },
            {
                code: "Binaries missing/corrupted",
                description: "Please restart the app, or disable antivirus.",
                trigger: "Command failed with ENOENT: binaries/youtube-dl.exe"
            },
            {
                code: "Missing dependency",
                description: "Please install <a href=\"https://github.com/jely2002/youtube-dl-gui#how-to-use\" target=\"_blank\"> Microsoft Visual C++ 2010</a>",
                trigger: "3221225781"
            }
        ]
    }

    checkError(stderr, identifier) {
        let foundError = false;
        if(stderr == null) {
            console.error("An error has occurred but no error message was given.")
            return false;
        }
        for(const errorDef of this.errorDefinitions) {
            if(stderr.includes(errorDef.trigger)) {
                foundError = true;
                if(errorDef.code === "ffmpeg not found" && process.argv[2] === '--dev') break; //Do not raise a 'ffmpeg not found' error when in dev mode
                this.raiseError(errorDef, identifier);
                break;
            }
        }
        if(!foundError) {
            if(stderr.includes("ERROR")) {
                foundError = true;
                console.error(stderr)
                this.raiseUnhandledError(stderr, identifier);
            }
        }
        return foundError;
    }

    raiseUnhandledError(error, identifier) {
        const video = this.queryManager.getVideo(identifier);
        if(video == null) return;
        if(video.type === "playlist") return;
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
        const video = this.queryManager.getVideo(identifier);
        if(video == null) return;
        if(video.type === "playlist") return;
        console.error(errorDef.code + " - " + errorDef.description);
        this.win.webContents.send("error", { error: errorDef, identifier: identifier, unexpected: false });
        this.queryManager.onError(identifier);
    }

    async reportError(args) {
        for(const err of this.unhandledErrors) {
            if(err.identifier === args.identifier) {
                let video = this.queryManager.getVideo(args.identifier)
                err.url = video.url;
                err.type = args.type;
                err.quality = args.quality;
                return await this.env.analytics.sendReport(err);
            }
        }
    }
}

module.exports = ErrorHandler;
