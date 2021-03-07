const Utils = require("./Utils");
const { autoUpdater } = require("electron-updater");

class AppUpdater {
    constructor(env, win) {
        this.env = env;
        this.win = win;
        this.initializeEvents();
    }

    initializeEvents() {
        autoUpdater.on('download-progress', (progressObj) => {
            const percent = Math.round(progressObj.percent);
            const progress = `${Utils.convertBytes(progressObj.transferred)} / ${Utils.convertBytes(progressObj.total)}`;
            const speed = Utils.convertBytesPerSecond(progressObj.bytesPerSecond);
            this.win.webContents.send('toast', {
                type: "update",
                title: `Downloading update ${this.newVersion}`,
                body: `<p>${progress} | ${speed}</p>
                       <div class="progress" style="height: 5px;">
                       <div class="progress-bar" role="progressbar" style="width: ${percent}%;" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"></div>
                       </div>`
            });
        })
    }

    checkUpdate() {
        if(!this.isUpdateAllowed()) return;
        autoUpdater.checkForUpdates().then((result) => {
            if(result.downloadPromise != null) {
                if(process.platform === "darwin") {
                    //Show only toast on mac
                    this.win.webContents.send('toast', {
                        type: "update",
                        title: "An update has been found",
                        body: `Update ${result.updateInfo.releaseName} is out now! <br> <a target="_blank" href="https://github.com/jely2002/youtube-dl-gui/releases/latest">Download on GitHub</a>`
                    });
                } else {
                    this.newVersion = result.updateInfo.releaseName;
                    result.downloadPromise.then(() => {
                        this.win.webContents.send('toast', {
                            type: "update",
                            title: `Update ${result.updateInfo.releaseName} was downloaded`,
                            body: `<p>Do you want to install it now?</p><button class="btn" id="install-btn">Sure</button><button class="btn" data-dismiss="toast">Not now</button>`
                        });
                    })
                }
            }
        })
    }

    installUpdate() {
        //IsSilent: false (show progress), forceReOpen: true (reopen the app after updating has finished)
        autoUpdater.quitAndInstall(false, true);
    }

    isUpdateAllowed() {
        return (this.env.settings.updateApplication && process.argv[2] !== '--dev') || (process.argv[2] === "--dev" && process.argv[3] === "--test-update");
    }

    setUpdateSetting(value) {
        autoUpdater.autoInstallOnAppQuit = !!value;
        if(value === true) {
            this.checkUpdate();
        }
    }

}
module.exports = AppUpdater;
