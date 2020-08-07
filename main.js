const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const { autoUpdater } = require("electron-updater")
const fs = require('fs')
const mkdirp = require('mkdirp')

let doneIcon
let downloadingIcon

//Set icon file paths depending on the platform
if(process.platform === "darwin") {
    doneIcon = nativeImage.createFromPath( app.getAppPath().slice(0, -8) + 'done-icon.png')
    downloadingIcon = nativeImage.createFromPath(app.getAppPath().slice(0, -8) + 'downloading-icon.png')
} else {
    doneIcon = nativeImage.createFromPath('resources/done-icon.png')
    downloadingIcon = nativeImage.createFromPath('resources/downloading-icon.png')
}

if(process.platform === "linux") {
    let readonlyResources = app.getAppPath().slice(0, -8)
    let destination = app.getPath("home") + "/.youtube-dl-gui/"
    mkdirp(app.getPath("home") + "/.youtube-dl-gui/").then(made => {
        if(made !== null) {
            fs.copyFile(readonlyResources + "youtube-dl-darwin", destination + "youtube-dl-darwin", (err) => {
                if (err) throw err
                console.log('youtube-dl-darwin copied to home data')
            })
            fs.copyFile(readonlyResources + "ffmpeg-linux", destination + "ffmpeg", (err) => {
                if (err) throw err
                console.log('ffmpeg copied to home data')
            })
            fs.copyFile(readonlyResources + "details", destination + "details", (err) => {
                if (err) throw err
                console.log('details copied to home data')
            })
        }
    })
}


let win

//Create the window for the renderer process
function createWindow () {
    app.allowRendererProcessReuse = true
    if(process.platform === "darwin") {
        win = new BrowserWindow({
            show: false,
            width: 800, //850
            height: 500, //550
            resizable: false,
            maximizable: false,
            titleBarStyle: "hidden",
            icon: "web-resources/icon-light.png",
            webPreferences: {
                nodeIntegration: true
            }
        })
    } else {
        autoUpdater.checkForUpdatesAndNotify();
            win = new BrowserWindow({
                show: false,
                width: 800, //850
                height: 530, //550
                resizable: false,
                maximizable: false,
                frame: false,
                icon: "web-resources/icon-light.png",
                webPreferences: {
                    nodeIntegration: true
                }
            })
    }
    win.removeMenu()
    if(process.argv[2] === '--dev') {
        win.webContents.openDevTools()
    }
    win.loadFile('index.html')
    win.on('closed', () => {
        win = null
    })

    win.once('ready-to-show', () => {
        win.show()
    })
}

app.on('ready', () => {
    /*app.setLoginItemSettings({         TODO Sync playlists on startup
        openAtLogin: false,
        openAsHidden: true,
        args: [
            '--startup'
        ]
    })

    if(process.argv.includes('startup')) {
        startUpdate(() => {
            app.quit()
        })
    } else {
        createWindow()
    }*/
    createWindow()
 })

//Quit the application when all windows are closed, except for darwin
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

//Create a window when there is none, but the app is still active (darwin)
app.on('activate', () => {
    if (win === null /*&& !process.argv.includes('startup') TODO Sync playlists on startup*/) {
        createWindow()
    }
});


//Event handler to process icon updates from the renderer process
ipcMain.on('request-mainprocess-action', (event, arg) => {
    if(arg.mode === "hide") {
        win.setOverlayIcon(null, "")
    } else if(arg.mode === "downloading") {
        win.setOverlayIcon(downloadingIcon, "downloading")
    } else if(arg.mode === "done") {
        win.setOverlayIcon(doneIcon, "done")
    }
})
