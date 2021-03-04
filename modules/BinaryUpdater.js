const axios = require("axios");
const fs = require("fs");

class BinaryUpdater {

    constructor(paths, win) {
        this.paths = paths;
        this.win = win;
    }

    //Checks for an update and download it if there is.
    async checkUpdate() {
        console.log("Checking for a new version of ytdl.");
        const localVersion = await this.getLocalVersion();
        const [remoteUrl, remoteVersion] = await this.getRemoteVersion();
        if(remoteVersion === localVersion) {
            console.log(`Binaries were already up-to-date! Version: ${localVersion}`);
        } else if(localVersion == null) {
            console.log("Binaries may have been corrupted, downloading binaries to be on the safe side.");
            this.win.webContents.send("binaryLock", {lock: true, placeholder: `Re-installing ytdl version ${remoteVersion}...`})
            await this.downloadUpdate(remoteUrl, remoteVersion);
        } else if(remoteVersion == null) {
            console.log("Unable to check for new updates, yt-dl.org may be down.");
        } else {
            console.log(`New version ${remoteVersion} found. Updating...`);
            this.win.webContents.send("binaryLock", {lock: true, placeholder: `Updating ytdl to version ${remoteVersion}...`})
            await this.downloadUpdate(remoteUrl, remoteVersion);
        }
    }

    //Returns the currently downloaded version of youtube-dl
    async getLocalVersion() {
        let data;
        try {
            const result = await fs.promises.readFile(this.paths.ytdlVersion);
            data = JSON.parse(result);
        } catch (err) {
            console.error(err);
            data = null;
        }
        if(data == null) {
            return null;
        } else {
            console.log("Current version: " + data.version);
            return data.version;
        }
    }

    //Returns an array containing the latest available remote version and the download link to it.
    async getRemoteVersion() {
        const url = (this.paths.platform === "win32") ? "http://yt-dl.org/downloads/latest/youtube-dl.exe" : "http://yt-dl.org/downloads/latest/youtube-dl";
        let response;
        try {
            response = await axios.get(url, {maxRedirects: 0}) //This uses an http url because the site uses an invalid certificate.
        } catch (err) {
            if(err == null || response == null) {
                console.error(err);
                return [null, null];
            } else if (err.response.status !== 302) {
                console.error('Did not get redirect for the latest version link. Status: ' + err.response.status);
                return [null, null];
            } else {
                return [err.response.headers.location, /yt-dl\.org\/downloads\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(err.response.headers.location)[1]];
            }
        }
        console.error('Did not get redirect for the latest version link. Status: ' + response.status);
        return [null, null];
    }

    //Downloads the file at the given url and saves it to the ytdl path.
    async downloadUpdate(remoteUrl, remoteVersion) {
        const writer = fs.createWriteStream(this.paths.ytdl);
        await axios.get(remoteUrl, {responseType: 'stream'}).then(response => {
            return new Promise((resolve, reject) => {
                response.data.pipe(writer);
                let error = null;
                writer.on('error', err => {
                    error = err;
                    writer.close();
                    reject(err);
                });
                writer.on('close', () => {
                    if (!error) {
                        this.writeVersionInfo(remoteVersion);
                        resolve(true);
                    }
                });
            });
        });
    }

    //Writes the new version number to the ytdlVersion file
    writeVersionInfo(version) {
        const data = {version: version};
        fs.promises.writeFile(this.paths.ytdlVersion, JSON.stringify(data)).then(() => {
            console.log("New version data written to ytdlVersion.");
        });
    }
}

module.exports = BinaryUpdater;
