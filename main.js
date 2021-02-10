const { app, BrowserWindow, ipcMain, nativeImage, dialog, Menu, globalShortcut, shell} = require('electron');
const { autoUpdater } = require("electron-updater");
const fs = require('fs');
const Environment = require('./modules/Environment');
const path = require('path');
const QueryManager = require("./modules/QueryManager");
const ErrorHandler = require("./modules/ErrorHandler");

let doneIcon
let downloadingIcon

let win
let env
let queryManager

//Set icon file paths depending on the platform
if(process.platform === "darwin") {
    doneIcon = nativeImage.createFromPath( app.getAppPath().slice(0, -8) + 'renderer/img/done-icon.png')
    downloadingIcon = nativeImage.createFromPath(app.getAppPath().slice(0, -8) + 'renderer/img/downloading-icon.png')
} else {
    doneIcon = nativeImage.createFromPath('renderer/img/done-icon.png')
    downloadingIcon = nativeImage.createFromPath('renderer/img/downloading-icon.png')
}

//Create the window for the renderer process
function createWindow(env) {
    win = new BrowserWindow({
        show: false,
        minWidth: 700,
        minHeight: 650,
        width: 815,
        height: 800,
        backgroundColor: '#212121',
        titleBarStyle: process.platform === "darwin" ? null : "hidden",
        frame: false,
        icon: env.paths.icon,
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: false,
            worldSafeExecuteJavaScript: true,
            spellcheck: false,
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    })
    win.removeMenu()
    if(process.argv[2] === '--dev') {
        win.webContents.openDevTools()
    }
    win.loadFile(path.join(__dirname, "renderer/renderer.html"))
    win.on('closed', () => {
        win = null
    })
    win.once('ready-to-show', () => {
        win.show()
    })
    win.webContents.on('did-finish-load', () => startCriticalHandlers(env));
}

app.on('ready', async () => {
    env = new Environment(app);
    await env.loadSettings();
    createWindow(env)
    registerShortcuts()
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
        createWindow(env)
    }
});

function startCriticalHandlers(env) {
    win.on('maximize', () => {
        win.webContents.send("maximized", true)
    });

    win.on('unmaximize', () => {
        win.webContents.send("maximized", false)
    });

    if(queryManager != null) return;
    queryManager = new QueryManager(win, env);
    env.errorHandler = new ErrorHandler(win, queryManager);

    ipcMain.handle('settingsAction', (event, args) => {
        switch(args.action) {
            case "get":
                return env.settings.serialize();
            case "save":
                env.settings.update(args.settings);
                break;
        }
    })

    ipcMain.handle('videoAction', async (event, args) => {
        switch (args.action) {
            case "stop":
                queryManager.stopSingle(args.identifier);
                break;
            case "open":
                queryManager.openVideo(args);
                break;
            case "download":
                if(args.all) queryManager.downloadAllVideos(args)
                else queryManager.downloadVideo(args);
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
            case "setmain":
                env.setMain(args);
                break;
            case "audioOnly":
                queryManager.setAudioOnly(args.identifier, args.value);
                break;
            case "audioQuality":
                queryManager.setAudioQuality(args.identifier, args.value);
                break;
            case "downloadable":
                return await queryManager.isDownloadable(args.identifier);
        }
    });
}

//Register shortcuts
function registerShortcuts() {
    globalShortcut.register('CommandOrControl+Shift+D', () => {
        win.webContents.openDevTools()
    })
    globalShortcut.register('CommandOrControl+Shift+F', () => {
        win.webContents.send('flushCache')
    })
}

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

//Return the platform to the renderer process
ipcMain.handle("platform", () => {
    return process.platform;
})

//Handle titlebar click events from the renderer process
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

//Show a dialog to select a folder, and return the selected value.
ipcMain.handle('downloadFolder', async (event) => {
    await dialog.showOpenDialog(win, {
        defaultPath: env.paths.downloadPath,
        buttonLabel: "Set download location",
        properties: [
            'openDirectory',
            'createDirectory'
        ]
    }).then(result => {
        if(result.filePaths[0] != null) env.paths.downloadPath = result.filePaths[0];
    });
});

ipcMain.handle('messageBox', (event, args) => {
   dialog.showMessageBoxSync(win, {
       title: args.title,
       message: args.message,
       type: "none",
       buttons: [],
   }) ;
});

//Show a dialog to select a file, and return the selected value.
ipcMain.handle('cookieFile', async (event,clear) => {
    if(clear === true) {
        env.settings.cookiePath = null;
        env.settings.save();
        return;
    } else if(clear === "get") {
        return env.settings.cookiePath;
    }
    let result = await dialog.showOpenDialog(win, {
        buttonLabel: "Select file",
        defaultPath: (env.settings.cookiePath != null) ? env.settings.cookiePath : env.paths.downloadPath,
        properties: [
            'openFile',
            'createDirectory'
        ],
        filters: [
            { name: "txt", extensions: ["txt"] },
            { name: "All Files", extensions: ["*"] },
        ],
    });
    if(result.filePaths[0] != null) {
        env.settings.cookiePath = result.filePaths[0];
        env.settings.save();
    }
    return result.filePaths[0];
})
