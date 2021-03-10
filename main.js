const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, shell} = require('electron');
const Environment = require('./modules/Environment');
const path = require('path');
const QueryManager = require("./modules/QueryManager");
const ErrorHandler = require("./modules/ErrorHandler");
const BinaryUpdater = require("./modules/BinaryUpdater");
const AppUpdater = require("./modules/AppUpdater");

let win
let env
let queryManager
let appStarting = true;

//Create the window for the renderer process
function createWindow(env) {
    win = new BrowserWindow({
        show: false,
        minWidth: 700,
        minHeight: 650,
        width: 815,
        height: 800,
        backgroundColor: '#212121',
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
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
    await env.initialize();
    createWindow(env);
    if(app.isPackaged && process.argv[2] !== '--dev') {
        env.analytics.sendDownload();
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

    //Force links with target="_blank" to be opened in an external browser
    win.webContents.on('new-window', function(e, url) {
        e.preventDefault();
        shell.openExternal(url);
    });

    queryManager = new QueryManager(win, env);
    env.errorHandler = new ErrorHandler(win, queryManager, env);

    if(appStarting) {
        appStarting = false;

        //Catch all console.log calls, print them to stdout and send them to the renderer devtools.
        console.log = (arg) => {
            process.stdout.write(arg + "\n");
            sendLogToRenderer(arg, false);
        };

        //Catch all console.error calls, print them to stderr and send them to the renderer devtools.
        console.error = (arg) => {
            process.stderr.write(arg + "\n");
            sendLogToRenderer(arg, true);
        }

        ipcMain.handle('errorReport', async (event, args) => {
            return await env.errorHandler.reportError(args);
        });

        ipcMain.handle('settingsAction', (event, args) => {
            switch (args.action) {
                case "get":
                    return env.settings.serialize();
                case "save":
                    env.settings.update(args.settings);
                    break;
            }
        })

        if(env.settings.updateBinary) {
            let binaryUpdater = new BinaryUpdater(env.paths, win);
            win.webContents.send("binaryLock", {lock: true, placeholder: `Checking for a new version of ytdl...`})
            binaryUpdater.checkUpdate().finally(() => { win.webContents.send("binaryLock", {lock: false}) });
        }

        let appUpdater = new AppUpdater(env, win);
        env.appUpdater = appUpdater;
        appUpdater.checkUpdate();

        ipcMain.handle("installUpdate", () => {
           appUpdater.installUpdate();
        });

        ipcMain.handle('videoAction', async (event, args) => {
            switch (args.action) {
                case "stop":
                    queryManager.stopSingle(args.identifier);
                    break;
                case "open":
                    queryManager.openVideo(args);
                    break;
                case "download":
                    if (args.downloadType === "all") queryManager.downloadAllVideos(args)
                    else if(args.downloadType === "unified") queryManager.downloadUnifiedPlaylist(args);
                    else if(args.downloadType === "single") queryManager.downloadVideo(args);
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
                case "downloadThumb":
                    queryManager.saveThumb(args.url);
                    break;
                case "getSize":
                    return await queryManager.getSize(args.identifier, args.formatLabel, args.audioOnly, args.clicked);
                case "setSubtitles":
                    env.setSubtitles(args.value);
                    break;
                case "downloadable":
                    return await queryManager.isDownloadable(args.identifier);
            }
        });
    }
}

function sendLogToRenderer(log, isErr) {
    win.webContents.send("log", {log: log, isErr: isErr});
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

//Show a messagebox with a custom title and message
ipcMain.handle('messageBox', (event, args) => {
   dialog.showMessageBoxSync(win, {
       title: args.title,
       message: args.message,
       type: "none",
       buttons: [],
   }) ;
});


