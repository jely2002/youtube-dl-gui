const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard } = require('electron');
const Environment = require('./modules/Environment');
const path = require('path');
const QueryManager = require("./modules/QueryManager");
const ErrorHandler = require("./modules/exceptions/ErrorHandler");
const BinaryUpdater = require("./modules/BinaryUpdater");
const AppUpdater = require("./modules/AppUpdater");
const TaskList = require("./modules/persistence/TaskList");
const DoneAction = require("./modules/DoneAction");
const ClipboardWatcher = require("./modules/ClipboardWatcher");
const Analytics = require("./modules/Analytics");
const FfmpegUpdater = require('./modules/FfmpegUpdater');

let win
let env
let queryManager
let clipboardWatcher
let taskList
let analytics;
let appStarting = true;

analytics = new Analytics(app);
analytics.initSentry().then((res) => console.log(res));

function sendLogToRenderer(log, isErr) {
    if(win == null) return;
    win.webContents.send("log", {log: log, isErr: isErr});
}

function startCriticalHandlers(env) {
     env.win = win;

    win.on('maximize', () => {
        win.webContents.send("maximized", true)
    });

    win.on('unmaximize', () => {
        win.webContents.send("maximized", false)
    });

    //Force links with target="_blank" to be opened in an external browser
    win.webContents.on('new-window', (e, url) => {
        e.preventDefault();
        shell.openExternal(url);
    });

    clipboardWatcher = new ClipboardWatcher(win, env);

    queryManager = new QueryManager(win, env);

    taskList = new TaskList(env.paths, queryManager)

    if(env.settings.updateBinary) {
        const binaryUpdater = new BinaryUpdater(env.paths, win);
        const ffmpegUpdater = new FfmpegUpdater(env.paths, win);
        win.webContents.send("binaryLock", {lock: true, placeholder: `Checking for a new version of ffmpeg...`})
        ffmpegUpdater.checkUpdate().finally(() => {
            win.webContents.send("binaryLock", {lock: true, placeholder: `Checking for a new version of yt-dlp...`})
            binaryUpdater.checkUpdate().finally(() => {
                win.webContents.send("binaryLock", {lock: false});
                taskList.load();
                clipboardWatcher.startPolling();
            });
        });
    } else if(env.settings.taskList) {
        taskList.load();
    }

    //Send the saved download type to the renderer
    win.webContents.send("videoAction", {action: "setDownloadType", type: env.settings.downloadType});

    env.errorHandler = new ErrorHandler(win, queryManager, env);

    if(appStarting) {
        appStarting = false;

        //Restore the videos from last session
        ipcMain.handle("restoreTaskList", () => {
            taskList.restore()
        });

        //Send the log for a specific download to renderer
        ipcMain.handle("getLog", (event, identifier) => {
            return env.logger.get(identifier);
        });

        //Save the log when renderer asks main
        ipcMain.handle("saveLog", (event, identifier) => {
            return env.logger.save(identifier);
        })

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

        ipcMain.handle('iconProgress', (event, args) => {
            win.setProgressBar(args);
            if(args === 1) {
                if(process.platform === "darwin") app.dock.bounce();
                else win.flashFrame(true);
                win.setProgressBar(-1);
            }
        });

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

        let appUpdater = new AppUpdater(env, win);
        env.appUpdater = appUpdater;
        if(!env.paths.appPath.includes("\\AppData\\Local\\Temp\\") && !env.paths.appPath.includes("WindowsApps")) {
            //Don't check the app when it is in portable mode
            appUpdater.checkUpdate();
        }

        ipcMain.handle("installUpdate", () => {
            appUpdater.installUpdate();
        });

        ipcMain.handle('setDoneAction', (event, args) => {
            env.doneAction = args.action;
        });

        ipcMain.handle('getSubtitles', (event, args) => {
            return queryManager.getAvailableSubtitles(args.identifier, args.unified);
        });

        ipcMain.handle('getSelectedSubtitles', (event, args) => {
            return queryManager.getSelectedSubtitles(args.identifier);
        });

        ipcMain.handle('videoAction', async (event, args) => {
            switch (args.action) {
                case "stop":
                    queryManager.stopDownload(args.identifier);
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
                    return await queryManager.getSize(args.identifier, args.formatLabel, args.audioOnly, args.videoOnly, args.clicked, args.encoding, args.audioEncoding);
                case "setSubtitles":
                    queryManager.setSubtitle(args);
                    break;
                case "globalSubtitles":
                    queryManager.setGlobalSubtitle(args.value);
                    break;
                case "downloadable":
                    return await queryManager.isDownloadable(args.identifier);
            }
        });
    }
}

//Create the window for the renderer process
function createWindow(env) {
    win = new BrowserWindow({
        show: false,
        minWidth: 840,
        minHeight: 650,
        width: 860,
        height: 840,
        backgroundColor: env.settings.theme === "dark" ? '#212121' : '#ffffff',
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
    if(process.argv[2] === '--dev') {
        win.webContents.openDevTools()
    }
    win.loadFile(path.join(__dirname, "renderer/renderer.html"))
    win.on('closed', () => {
        win = null
    })
    win.once('focus', () => win.flashFrame(false))
    win.webContents.on('did-finish-load', () => {
        win.show();
        startCriticalHandlers(env)
    });
}

app.on('ready', async () => {
    app.setAppUserModelId("com.jelleglebbeek.youtube-dl-gui");
    env = new Environment(app, analytics);
    await env.initialize();
    createWindow(env);
})

app.on('before-quit', async () => {
    await taskList.save();
})

//Quit the application when all windows are closed, except for darwin
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

//Create a window when there is none, but the app is still active (darwin)
app.on('activate', () => {
    if (win === null) {
        createWindow(env)
    }
});

//Creates the input menu to show on right click
const InputMenu = Menu.buildFromTemplate([
    {
        label: 'Cut',
        role: 'cut',
    },
    {
        label: 'Copy',
        role: 'copy',
    },
    {
        label: 'Paste',
        role: 'paste',
    },
    {
        type: 'separator',
    },
    {
        label: 'Select all',
        role: 'selectall',
    },
]);

//Opens the input menu when ordered from renderer process
ipcMain.handle('openInputMenu', () => {
    InputMenu.popup(win);
})

ipcMain.handle('openCopyMenu', (event, content) => {
    const CopyMenu = Menu.buildFromTemplate([
        {
            label: 'Copy link address',
            click: () => {
                clipboard.writeText(content);
            }
        }
    ]);
    CopyMenu.popup(win);
})

//Return the platform to the renderer process
ipcMain.handle("platform", () => {
    return process.platform;
})


//Return the available actions to the renderer process
ipcMain.handle('getDoneActions', () => {
    const doneAction = new DoneAction();
    return doneAction.getActions();
});

//Return the user selected theme to the renderer process
ipcMain.handle("theme", () => {
    return env.settings.theme;
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
ipcMain.handle('downloadFolder', async () => {
    await dialog.showOpenDialog(win, {
        defaultPath:  env.settings.downloadPath,
        buttonLabel: "Set download location",
        properties: [
            'openDirectory',
            'createDirectory'
        ]
    }).then(result => {
        if(result.filePaths[0] != null) {
            env.settings.downloadPath = result.filePaths[0];
            env.settings.save();
        }
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
        defaultPath: (env.settings.cookiePath != null) ? env.settings.cookiePath : env.settings.downloadPath,
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
        message: (args.message.startsWith("Youtube-dl returned an empty object")) ? "Youtube-dl returned an empty object" : args.message,
        type: "none",
        buttons: [],
    });
});


