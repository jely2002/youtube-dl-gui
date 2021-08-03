const {dialog} = require("electron");
const path = require("path");
const fs = require("fs");

class Logger {
    constructor(environment) {
        this.environment = environment;
        this.logs = {};
    }

    log(identifier, line) {
        if(line == null || line === "") return;
        let trimmedLine;
        if(line === "done") {
            trimmedLine = "Download finished";
        } else if(line === "killed") {
            trimmedLine = "Download stopped";
        } else {
            trimmedLine = line.replace(/[\n\r]/g, "");
        }
        if(identifier in this.logs) {
            this.logs[identifier].push(trimmedLine);
        } else {
            this.logs[identifier] = [trimmedLine];
        }
    }

    get(identifier) {
        return this.logs[identifier];
    }

    clear(identifier) {
        delete this.logs[identifier];
    }

    async save(identifier) {
        const logLines = this.logs[identifier];
        let log = "";
        for(const line of logLines) {
            log += line + "\n";
        }
        const date = new Date().toLocaleString()
            .replace(", ", "-")
            .replace(/\//g, "-")
            .replace(/:/g, "-")
        let result = await dialog.showSaveDialog(this.environment.win, {
            defaultPath: path.join(this.environment.settings.downloadPath, "ytdl-log-" + date.slice(0, date.length - 6)),
            buttonLabel: "Save metadata",
            filters: [
                { name: "txt", extensions: ["txt"] },
                { name: "All Files", extensions: ["*"] },
            ],
            properties: ["createDirectory"]
        });
        if(!result.canceled) {
            fs.promises.writeFile(result.filePath, log).then(() => console.log("Download log saved."));
        }
    }

}

module.exports = Logger;
