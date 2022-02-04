const { clipboard } = require('electron');

class ClipboardWatcher {
    constructor(win, env) {
        this.win = win;
        this.env = env;
        this.urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?/gi;
    }

    startPolling() {
        this.poll();
        this.pollId = setInterval(() => this.poll(), 1000);
    }

    resetPlaceholder() {
        const standard = "Enter a video/playlist URL to add to the queue";
        if (this.win != null) {
            this.win.webContents.send("updateLinkPlaceholder", {text: standard, copied: false});
        }
    }

    poll() {
        if(this.env.settings.autoFillClipboard) {
            const text = clipboard.readText();
            if (text != null) {
                if (this.previous != null && this.previous === text) return;
                this.previous = text;
                const isURL = text.match(this.urlRegex);
                if (isURL) {
                    if (this.win != null) {
                        this.win.webContents.send("updateLinkPlaceholder", {text: text, copied: true});
                    }
                } else {
                    this.resetPlaceholder();
                }
            } else {
                this.resetPlaceholder();
            }
        }
    }
}

module.exports = ClipboardWatcher;
