const axios = require("axios");
const fs = require("fs");
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const os = require("os");
const AdmZip = require("adm-zip");
const Utils = require('./Utils');
const {Agent} = require("https");

class MitmProxyUpdater {

    constructor(paths, win) {
        this.paths = paths;
        this.win = win;
        this.action = "Installing";
    }

    //Checks for an update and download it if there is.
    async checkUpdate() {
        if (await this.checkPreInstalled()) {
            console.log("mitmproxy already installed, skipping auto-install.")
            return;
        }
        console.log("Checking for a new version of mitmproxy.");
        const localVersion = await this.getLocalVersion();
        const { remoteMitmProxyUrl, remoteVersion } = await this.getRemoteVersion();

        if(remoteVersion === localVersion) {
            console.log(`mitmproxy was already up-to-date! Version: ${localVersion}`);
            return;
        }
        if(localVersion == null) {
            console.log("Downloading missing mitmproxy binary.");
        } else {
            console.log(`New version ${remoteVersion} found. Updating...`);
            this.action = "Updating to";
        }
         if(remoteVersion){
            this.win.webContents.send("binaryLock", {lock: true, placeholder: `Installing/Updating mitmproxy to version: ${remoteVersion}. Preparing...`})
            await this.downloadUpdate(remoteMitmProxyUrl, remoteVersion, "mitmweb" + this.getFileExtension());
            await this.writeVersionInfo(remoteVersion);
        }
        this.paths.setPermissions();
    }

    async checkPreInstalled() {
        try {
            await exec("mitmweb --version");
            return true;
        } catch (e) {
            return false;
        }
    }

    async getRemoteVersion() {
        try {
            let platform = "windows-amd64";

/**
 * Missing: const httpsAgent = new Agent({
 *    rejectUnauthorized: false
 *  });
 *  const res = await axios.get("https://ffbinaries.com/api/v1/version/latest", {httpsAgent});
 */
            if (os.arch() === "x32" || os.arch() === "ia32") platform = "windows-amd64";
            if (this.paths.platform === "darwin") platform = "macos-arm";
            else if (this.paths.platform === "linux") platform = "linux-amd64";
            return {
                remoteVersion: "10.4.2",//Missing: upload asset for release version in mitmproxy workflow
                remoteMitmProxyUrl: 'https://github.com/mp3butcher/mitmproxy/releases/download/zipped/mitmproxy.' + platform + '.zip'
            };
        } catch (err) {
            console.error('An error occurred while retrieving the latest mitmproxy version data.')
            if (err.response != null) {
                console.error('Status code: ' + err.response.status);
            }
            return {
                remoteVersion: null,
                remoteMitmProxyUrl: null
            };
        }
    }

    //Returns the currently downloaded version of yt-dlp
   async getLocalVersion() {
        let data;
        try {
            const result = await fs.promises.readFile(this.paths.mitmproxyVersion);
            data = JSON.parse(result);
        } catch (err) {
            console.error(err);
            data = null;
        }
        try {
            await fs.promises.access(path.join(this.paths.mitmproxy, "mitmweb" + this.getFileExtension()));
        } catch(e) {
            data = null;
        }
        if(data == null) {
            return null;
        } else {
            console.log("Current mitmweb version: " + data.version);
            return data.version;
        }
    }

    //Downloads the file at the given url and saves it to the mitmproxy path.
    async downloadUpdate(url, version, filename) {
        const downloadPath = path.join(this.paths.mitmproxy, "downloads");
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath);
        }
        const writer = fs.createWriteStream(path.join(downloadPath, filename));

        const httpsAgent = new Agent({
            rejectUnauthorized: false
        });
        const { data, headers } = await axios.get(url, {responseType: 'stream', httpsAgent});
        const totalLength = +headers['content-length'];
        const total = Utils.convertBytes(totalLength);
        const artifact = filename.replace(".exe", "");
        let received = 0;
        await new Promise((resolve, reject) => {
            let error = null;
            data.on('data', (chunk)  => {
                received += chunk.length;
                const percentage = ((received / totalLength) * 100).toFixed(0) + '%';
                this.win.webContents.send("binaryLock", {lock: true, placeholder: `${this.action} ${artifact} ${version} - ${percentage} of ${total}`})
            });
            writer.on('error', err => {
                error = err;
                reject(err);
            });
            writer.on('close', async () => {
                if (!error) {
                    resolve(true);
                }
            });
            data.pipe(writer);
        });
        this.win.webContents.send("binaryLock", {lock: true, placeholder: `${this.action} ${artifact} ${version} - Extracting binaries...`})
        const zipFile = new AdmZip(path.join(downloadPath, filename), {});
        zipFile.extractEntryTo(filename, this.paths.mitmproxy, false, true, false, filename);
        fs.rmSync(path.join(this.paths.mitmproxy, "downloads"), { recursive: true, force: true });
    }

    //Writes the new version number to the ytdlVersion file
    async writeVersionInfo(version) {
        const data = {
            version: version,
        };
        await fs.promises.writeFile(this.paths.mitmproxyVersion, JSON.stringify(data));
        console.log("New version data written to mitmproxyVersion.");
    }

    getFileExtension() {
        if (process.platform === "win32") return ".exe";
        else return "";
    }
}

module.exports = MitmProxyUpdater;
