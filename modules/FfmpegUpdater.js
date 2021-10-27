const axios = require("axios");
const fs = require("fs");
const Sentry = require("@sentry/node");
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const os = require("os");
const AdmZip = require("adm-zip");
const Utils = require('./Utils');

class FfmpegUpdater {

    constructor(paths, win) {
        this.paths = paths;
        this.win = win;
        this.action = "Installing";
    }

    //Checks for an update and download it if there is.
    async checkUpdate() {
        if (await this.checkPreInstalled()) {
            console.log("FFmpeg and FFprobe already installed, skipping auto-install.")
            return;
        }
        const transaction = Sentry.startTransaction({ name: "checkUpdate" });
        const span = transaction.startChild({ op: "task" });
        console.log("Checking for a new version of ffmpeg.");
        const localVersion = await this.getLocalVersion();
        const { remoteFfmpegUrl, remoteFfprobeUrl, remoteVersion } = await this.getRemoteVersion();
        if(remoteVersion === localVersion) {
            transaction.setTag("download", "up-to-date");
            console.log(`ffmpeg was already up-to-date! Version: ${localVersion}`);
        } else if(localVersion == null) {
            transaction.setTag("download", "corrupted");
            console.log("Downloading missing ffmpeg binary.");
            this.win.webContents.send("binaryLock", {lock: true, placeholder: `Installing ffmpeg version: ${remoteVersion}. Preparing...`})
            await this.downloadUpdate(remoteFfmpegUrl, remoteVersion, "ffmpeg" + this.getFileExtension());
            this.win.webContents.send("binaryLock", {lock: true, placeholder: `Installing ffprobe version: ${remoteVersion}. Preparing...`})
            await this.downloadUpdate(remoteFfprobeUrl, remoteVersion, "ffprobe" + this.getFileExtension());
            await this.writeVersionInfo(remoteVersion);
        } else if(remoteVersion == null) {
            transaction.setTag("download", "down");
            console.log("Unable to check for new updates, ffbinaries.com may be down.");
        } else {
            console.log(`New version ${remoteVersion} found. Updating...`);
            transaction.setTag("download", "update");
            this.action = "Updating to";
            this.win.webContents.send("binaryLock", {lock: true, placeholder: `Updating ffmpeg to version: ${remoteVersion}. Preparing...`})
            await this.downloadUpdate(remoteFfmpegUrl, remoteVersion, "ffmpeg" + this.getFileExtension());
            this.win.webContents.send("binaryLock", {lock: true, placeholder: `Updating ffprobe to version: ${remoteVersion}. Preparing...`})
            await this.downloadUpdate(remoteFfprobeUrl, remoteVersion, "ffprobe" + this.getFileExtension());
            await this.writeVersionInfo(remoteVersion);
        }
        span.finish();
        transaction.finish();
    }

    async checkPreInstalled() {
        try {
            await exec("ffmpeg");
            await exec("ffprobe");
            return true;
        } catch (e) {
            return false;
        }
    }

    async getRemoteVersion() {
        try {
            const res = await axios.get("https://ffbinaries.com/api/v1/version/latest");
            let platform = "windows-64";
            if (os.arch() === "x32" || os.arch() === "ia32") platform = "windows-32";
            if (process.platform === "darwin") platform = "osx-64";
            else if (process.platform === "linux") platform = "linux-32";
            return {
                remoteVersion: res.data.version,
                remoteFfmpegUrl: res.data.bin[platform].ffmpeg,
                remoteFfprobeUrl: res.data.bin[platform].ffprobe,
            }
        } catch (err) {
            console.error('An error occurred while retrieving the latest ffmpeg version data.')
            if (err.response != null) {
                console.error('Status code: ' + err.response.status);
            }
            return null;
        }
    }

    //Returns the currently downloaded version of yt-dlp
   async getLocalVersion() {
        let data;
        try {
            const result = await fs.promises.readFile(this.paths.ffmpegVersion);
            data = JSON.parse(result);
        } catch (err) {
            console.error(err);
            data = null;
        }
        try {
            await fs.promises.access(path.join(this.paths.ffmpeg, "ffmpeg" + this.getFileExtension()));
            await fs.promises.access(path.join(this.paths.ffmpeg, "ffprobe" + this.getFileExtension()));
        } catch(e) {
            data = null;
        }
        if(data == null) {
            return null;
        } else {
            console.log("Current ffmpeg version: " + data.version);
            return data.version;
        }
    }

    //Downloads the file at the given url and saves it to the ffmpeg path.
    async downloadUpdate(url, version, filename) {
        const downloadPath = path.join(this.paths.ffmpeg, "downloads");
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath);
        }
        const writer = fs.createWriteStream(path.join(downloadPath, filename));

        const { data, headers } = await axios.get(url, {responseType: 'stream'});
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
        zipFile.extractEntryTo(filename, this.paths.ffmpeg, false, true, false, filename);
        fs.rmdirSync(path.join(this.paths.ffmpeg, "downloads"), { recursive: true, force: true });
    }

    //Writes the new version number to the ytdlVersion file
    async writeVersionInfo(version) {
        const data = {
            version: version,
        };
        await fs.promises.writeFile(this.paths.ffmpegVersion, JSON.stringify(data));
        console.log("New version data written to ffmpegVersion.");
    }

    getFileExtension() {
        if (process.platform === "win32") return ".exe";
        else return "";
    }
}

module.exports = FfmpegUpdater;
