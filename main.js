const { app, BrowserWindow, ipcMain, nativeImage, dialog, Menu, globalShortcut, shell} = require('electron')
const { autoUpdater } = require("electron-updater")
const fs = require('fs')
const mkdirp = require('mkdirp')
const Environment = require('./modules/types/Environment');
const Format = require('./modules/types/Format');
const DownloadQuery = require('./modules/download/DownloadQuery');
const InfoQueryList = require('./modules/info/InfoQueryList');
const DownloadQueryList = require('./modules/download/DownloadQueryList');
const InfoQuery = require('./modules/info/InfoQuery');
const path = require('path')

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
            height: 520, //550
            resizable: false,
            maximizable: false,
            titleBarStyle: "hidden",
            icon: "web-resources/icon-light.png",
            webPreferences: {
                nodeIntegration: false,
                enableRemoteModule: false,
                worldSafeExecuteJavaScript: true,
                spellcheck: false,
                preload: path.join(__dirname, 'modules/preload.js'),
                contextIsolation: true
            }
        })
    } else {
        win = new BrowserWindow({
            show: false,
            width: 800, //850
            height: 550, //550
            resizable: false,
            maximizable: false,
            frame: false,
            icon: "web-resources/icon-light.png",
            webPreferences: {
                nodeIntegration: false,
                enableRemoteModule: false,
                worldSafeExecuteJavaScript: true,
                spellcheck: false,
                preload: path.join(__dirname, 'modules/preload.js'),
                contextIsolation: true
            }
        })
    }
    win.removeMenu()
    if(process.argv[2] === '--dev') {
        win.webContents.openDevTools()
    }
    win.loadFile('main.html')
    win.on('closed', () => {
        win = null
    })
    win.once('ready-to-show', () => {
        win.show()
    })
    win.webContents.once('dom-ready', () => {
        setTimeout(() => {
            win.webContents.send("log", "Test log");
        }, 3000)
    });
}

app.on('ready', async () => {
    createWindow()
    let env = new Environment(process.platform, app.getAppPath(), app.getPath('home'), app.getPath('downloads'));
    //let urls = await new InfoQuery("https://www.youtube.com/playlist?list=PLlrW4E73Ro8AHvTJaJOe3dCRcdxzLMkHl", env).connect();
    let urls = await new InfoQuery("https://www.bbc.com/news/av/health-55281633", env).connect();
   //let urls = await new InfoQuery("https://www.pornhub.com/playlist/37628281", env).connect();
    /*let urls = {userSelection: [
            "https://www.pornhub.com/view_video.php?viewkey=ph5e650c975ba7f&pkey=37628281",
            "https://www.bbc.com/news/av/health-55281633",
            "https://www.youtube.com/watch?v=u7_GJwWlWrM",
            "https://vimeo.com/167919092"
        ]}*/
    let videos = await new InfoQueryList(urls, env).start();
    console.log("yo it should be done")
    setTimeout(() => {
        for(let video of videos) {
            win.webContents.send("log", video.formats[video.selected_format_index].height + "p" + video.formats[video.selected_format_index].fps);
        }
    }, 3000)

    /*setTimeout(() => {
        let download = new DownloadQueryList(videos, env);
        win.webContents.send("log", "start download")
        download.start().then(() => {
            win.webContents.send("log", "done")
        })
    }, 6000)*/


    if(isUpdateEnabled() && process.argv[2] !== '--dev') {
        if (process.platform === "darwin") {
            autoUpdater.checkForUpdates().then((result) => {
                result.currentVersion = app.getVersion();
                win.webContents.send('mac-update', result);
            })
        } else if (process.platform === "win32") {
            autoUpdater.checkForUpdatesAndNotify()
        }
    }
})

//Quit the application when all windows are closed, except for darwin
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

//Create a window when there is none, but the app is still active (darwin)
app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
});


//Event handler to process icon updates from the renderer process
ipcMain.handle('setOverlayIcon', (event, arg) => {
    if(arg.mode === "hide") {
        win.setOverlayIcon(null, "")
    } else if(arg.mode === "downloading") {
        win.setOverlayIcon(downloadingIcon, "downloading")
    } else if(arg.mode === "done") {
        win.setOverlayIcon(doneIcon, "done")
    }
})

//Creates the input menu to show on right click
const InputMenu = Menu.buildFromTemplate(
    [{
        label: 'Cut',
        role: 'cut',
    }, {
        label: 'Copy',
        role: 'copy',
    }, {
        label: 'Paste',
        role: 'paste',
    }, {
        type: 'separator',
    }, {
        label: 'Select all',
        role: 'selectall',
    },
    ]);

ipcMain.handle("platform", (event) => {
    return process.platform;
})

//Registers shortcuts
app.whenReady().then(() => {
    globalShortcut.register('CommandOrControl+Shift+D', () => {
        win.webContents.openDevTools()
    })
    globalShortcut.register('CommandOrControl+Shift+F', () => {
        win.webContents.send('flushCache')
    })
})

//Opens the input menu when ordered from renderer process
ipcMain.handle('openInputMenu', () => {
    InputMenu.popup(win);
})

//Update the progressbar when ordered from renderer process
ipcMain.handle('updateProgressBar', async (event, arg) => {
    if(arg === "hide") {
        await win.setProgressBar(-1, {mode: "none"})
    } else if(arg === "indeterminate") {
        win.setProgressBar(2, {mode: "indeterminate"})
    } else {
        await win.setProgressBar(arg)
    }
})


//Show a dialog to select a folder, and return the selected value.
ipcMain.on('openFolderDialog', async (event, selectedPath) => {
    await dialog.showOpenDialog(win, {
        defaultPath: selectedPath,
        properties: [
            'openDirectory',
            'createDirectory'
        ]
    }).then(result => {
        event.sender.send('directorySelected', result.filePaths[0])
    })
})

//Show a dialog to select a file, and return the selected value.
ipcMain.on('openFileDialog', async (event, filePath) => {
    await dialog.showOpenDialog(win, {
        defaultPath: filePath,
        properties: [
            'openFile',
            'createDirectory'
        ]
    }).then(result => {
        event.sender.send('fileSelected', result.filePaths[0])
    })
})

ipcMain.handle('getPath', (event, arg) => {
    if(arg === "appPath") {
        return app.getAppPath()
    } else {
        return app.getPath(arg)
    }
})

ipcMain.handle('isDev', (event) => {
    return process.argv[2] === '--dev'
})

ipcMain.handle('appInfo', async (event, arg) => {
    if(arg === "version") {
        return app.getVersion()
    } else if(arg === "country") {
        return app.getLocaleCountryCode()
    }
})

ipcMain.handle('titlebarClick', (event, arg) => {
    if(arg === 'close') {
        win.close()
    } else if(arg === "minimize") {
        win.minimize()
    }
})

ipcMain.handle('showItemInFolder', (event, arg) => {
    shell.showItemInFolder(arg)
})

ipcMain.handle('showFolder', (event, arg) => {
    shell.openPath(arg)
})

//Check if user has enabled auto-updating the app
function isUpdateEnabled() {
    let settingsPath
    if(process.platform === "darwin") {
        settingsPath = app.getAppPath().slice(0,-8) + 'settings'
    } else if(process.platform === "linux") {
        settingsPath = app.getPath('home') + "/.youtube-dl-gui/" + 'settings'
    } else {
        settingsPath = "resources/settings"
    }
    let settingsData
    try {
        settingsData = fs.readFileSync(settingsPath);
        return JSON.parse(settingsData)['update_app']
    } catch (err) {
        return true
    }
}
