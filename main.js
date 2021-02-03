const { app, BrowserWindow, ipcMain, nativeImage, dialog, Menu, globalShortcut, shell} = require('electron')
const { autoUpdater } = require("electron-updater")
const fs = require('fs')
const Environment = require('./modules/types/Environment');
const path = require('path')
const QueryManager = require("./modules/QueryManager");

let doneIcon
let downloadingIcon

let win

//Set icon file paths depending on the platform
if(process.platform === "darwin") {
    doneIcon = nativeImage.createFromPath( app.getAppPath().slice(0, -8) + 'assets/done-icon.png')
    downloadingIcon = nativeImage.createFromPath(app.getAppPath().slice(0, -8) + 'assets/downloading-icon.png')
} else {
    doneIcon = nativeImage.createFromPath('resources/assets/done-icon.png')
    downloadingIcon = nativeImage.createFromPath('resources/assets/downloading-icon.png')
}

//Create the window for the renderer process
function createWindow () {
    if(process.platform === "darwin") {
        win = new BrowserWindow({
            show: false,
            minWidth: 700,
            minHeight: 650,
            width: 815,
            height: 800,
            backgroundColor: '#212121',
            titleBarStyle: "hidden",
            icon: "resources/assets/icon.png",
            webPreferences: {
                nodeIntegration: false,
                enableRemoteModule: false,
                worldSafeExecuteJavaScript: true,
                spellcheck: false,
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true
            }
        })
    } else {
        win = new BrowserWindow({
            show: false,
            minWidth: 700,
            minHeight: 650,
            width: 815,
            height: 800,
            backgroundColor: '#212121',
            frame: false,
            icon: "resources/assets/icon.png",
            webPreferences: {
                nodeIntegration: false,
                enableRemoteModule: false,
                worldSafeExecuteJavaScript: true,
                spellcheck: false,
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true
            }
        })
    }
    win.removeMenu()
    if(process.argv[2] === '--dev') {
        win.webContents.openDevTools()
    }
    win.loadFile('renderer/renderer.html')
    win.on('closed', () => {
        win = null
    })
    win.once('ready-to-show', () => {
        win.show()
    })
    win.webContents.on('did-finish-load', () => {
        globalShortcut.register('CommandOrControl+Shift+D', () => {
            win.webContents.openDevTools()
        })
        globalShortcut.register('CommandOrControl+Shift+F', () => {
            win.webContents.send('flushCache')
        })

        win.on('maximize', () => {
            win.webContents.send("maximized", true)
        });

        win.on('unmaximize', () => {
            win.webContents.send("maximized", false)
        });

        let env = new Environment(process.platform, app.getAppPath(), app.getPath('home'), app.getPath('downloads'));
        let queryManager = new QueryManager(win, env);

        ipcMain.handle('videoAction', (event, args) => {
            console.log(args)
            switch (args.action) {
                case "stop":
                    queryManager.stopSingle(args.identifier);
                    break;
                case "open":
                    queryManager.openVideo(args);
                    break;
                case "download":
                    if(args.all) {
                        queryManager.downloadAllVideos(args)
                    } else {
                        queryManager.downloadVideo(args);
                    }
                    break;
                case "entry":
                    queryManager.manage(args.url);
                    break;
                case "info":
                    queryManager.showInfo(args.identifier);
                    break;
                case "downloadInfo":
                    queryManager.saveInfo(args.identifier);
                    break;
                case "size":
                    queryManager.startSizeQuery(args.identifier, args.formatLabel, args.clicked)
                    break;
            }
        });
    });
}

app.on('ready', async () => {
    createWindow()
    if(isUpdateEnabled() && process.argv[2] !== '--dev') {
        if (process.platform === "darwin") {
            autoUpdater.checkForUpdates().then((result) => {
                result.currentVersion = app.getVersion();
                win.webContents.send('mac-update', result);
            })
        } else if (process.platform === "win32" || process.platform === "linux") {
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
    ]
);

//Opens the input menu when ordered from renderer process
ipcMain.handle('openInputMenu', () => {
    InputMenu.popup(win);
})

ipcMain.handle("platform", () => {
    return process.platform;
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
    } else if(arg === "maximize") {
        if(win.isMaximized()) win.unmaximize();
        else win.maximize();
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
