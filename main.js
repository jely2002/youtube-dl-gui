const { app, BrowserWindow, ipcMain, nativeImage, dialog, Menu} = require('electron')
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
                nodeIntegration: true,
                enableRemoteModule: false,
                worldSafeExecuteJavaScript: true
            }
        })
    } else {
        autoUpdater.checkForUpdatesAndNotify();
            win = new BrowserWindow({
                show: false,
                width: 800, //850
                height: 540, //550
                resizable: false,
                maximizable: false,
                frame: false,
                icon: "web-resources/icon-light.png",
                webPreferences: {
                    nodeIntegration: true,
                    enableRemoteModule: false,
                    worldSafeExecuteJavaScript: true
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
}

app.on('ready', () => {
    createWindow()
    if(process.platform === "darwin") {
        autoUpdater.checkForUpdates().then((result) => {
            result.currentVersion = app.getVersion();
            win.webContents.send('mac-update', result)
        })
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
    console.log(selectedPath)
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
