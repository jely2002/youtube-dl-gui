const axios = require("axios");
const fs = require("fs");
const util = require('util');
const Utils = require('./Utils');
const exec = util.promisify(require('child_process').exec);

class BinaryUpdater {

    constructor(paths, win) {
        this.paths = paths;
        this.win = win;
        this.action = "Installing";
        this.platform = process.platform;
        this.systemVersion = null;
    }

    //Checks for an update and download it if there is.
    async checkUpdate() {
        if (await this.checkPreInstalled()) {
            console.log("yt-dlp already installed, skipping auto-install.")
            return;
        }
        console.log("Checking for a new version of yt-dlp.");
        const localVersion = await this.getLocalVersion();
        const remoteVersion = await this.getRemoteVersion();
        if(remoteVersion == null) {
            console.log("Unable to check for new updates, GitHub may be down.");
            return
        }
        if(remoteVersion === localVersion) {
            console.log(`Binaries were already up-to-date! Version: ${localVersion}`);
            return;
        }
        const remoteUrl = this.getBinaryUrl();
        if(localVersion == null) {
            console.log("Downloading missing yt-dlp binary.");
        } else {
            console.log(`New version ${remoteVersion} found. Updating...`);
            this.action = "Updating to";
        }
        this.win.webContents.send("binaryLock", {lock: true, placeholder: `Updating yt-dlp to version: ${remoteVersion}. Preparing...`})
        await this.downloadUpdate(remoteUrl, remoteVersion);
        this.paths.setPermissions()
    }

    async checkPreInstalled() {
        try {
            await exec("yt-dlp");
            await exec("ytdlp");
            return true;
        } catch (e) {
            return false;
        }
    }

    async getRemoteVersion() {
        const releaseUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/"
        try {
            await axios.get(releaseUrl, {
                responseType: 'document',
                maxRedirects: 0,
            })
        } catch (err) {
            const res = err.response;
            if (err.response == null) {
                console.error('An error occurred while retrieving the latest yt-dlp version data.')
                return null;
            }
            if (res.status !== 302) {
                console.error('Did not get redirect for the latest version link. Status: ' + err.response.status);
                return null;
            }
            const directUrl = res.headers.location;
            const versionRegex = directUrl.match(/[0-9]+\.[0-9]+\.[0-9]+/);
            return versionRegex ? versionRegex[0] : null;
        }
        return null;
    }

    getBinaryUrl() {
        console.info("platform - " + this.platform)
        if (this.platform === "win32") {
            return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        } else if (this.platform === "darwin") {
            let systemVersion = this.getSystemVersion();
            console.info("systemVersion - " + this.systemVersion)
            if (systemVersion < "10.15"){
                return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos_legacy";
            } else {
                return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
            }
        } else {
            return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
        }
    }

    getSystemVersion() {
        if (!this.systemVersion) {
            this.systemVersion = process.getSystemVersion()
        }
        return this.systemVersion;
    }

    //Returns the currently downloaded version of yt-dlp
   async getLocalVersion() {
        let data;
        try {
            const result = await fs.promises.readFile(this.paths.ytdlVersion);
            data = JSON.parse(result);
            if (!data.ytdlp) {
                data = null;
            }
        } catch (err) {
            console.error(err);
            data = null;
        }
        try {
            await fs.promises.access(this.paths.ytdl);
        } catch(e) {
            data = null;
        }
        if(data == null) {
            return null;
        } else {
            console.log("Current yt-dlp version: " + data.version);
            return data.version;
        }
    }

    //Downloads the file at the given url and saves it to the ytdl path.
    async downloadUpdate(remoteUrl, remoteVersion) {
        const writer = fs.createWriteStream(this.paths.ytdl);
        const { data, headers } = await axios.get(remoteUrl, {responseType: 'stream'});
        const totalLength = +headers['content-length'];
        const total = Utils.convertBytes(totalLength);
        let received = 0;
        return await new Promise((resolve, reject) => {
            let error = null;
            data.on('data', (chunk)  => {
                received += chunk.length;
                const percentage = ((received / totalLength) * 100).toFixed(0) + '%';
                this.win.webContents.send("binaryLock", {lock: true, placeholder: `${this.action} yt-dlp ${remoteVersion} - ${percentage} of ${total}`})
            });
            writer.on('error', err => {
                error = err;
                reject(err);
            });
            writer.on('close', async () => {
                if (!error) {
                    await this.writeVersionInfo(remoteVersion);
                    resolve(true);
                }
            });
            data.pipe(writer);
        });
    }

    //Writes the new version number to the ytdlVersion file
    async writeVersionInfo(version) {
        const data = {
            version: version,
            ytdlp: true
        };
        await fs.promises.writeFile(this.paths.ytdlVersion, JSON.stringify(data));
        console.log("New version data written to ytdlVersion.");
    }
}

module.exports = BinaryUpdater;
