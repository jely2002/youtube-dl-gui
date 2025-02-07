const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard } = require('electron');
const Environment = require('./modules/Environment');
const path = require('path');
const net = require('net');
const QueryManager = require("./modules/QueryManager");
const ErrorHandler = require("./modules/exceptions/ErrorHandler");
const BinaryUpdater = require("./modules/BinaryUpdater");
const AppUpdater = require("./modules/AppUpdater");
const TaskList = require("./modules/persistence/TaskList");
const DoneAction = require("./modules/DoneAction");
const ClipboardWatcher = require("./modules/ClipboardWatcher");
const FfmpegUpdater = require('./modules/FfmpegUpdater');
const MitmProxyUpdater = require('./modules/MitmProxyUpdater');
const Settings = require('./modules/persistence/Settings');
const Pyodide = require('pyodide');
const fs = require('node:fs');

let win
let env
let queryManager
let clipboardWatcher
let taskList
let appStarting = true;
let scannerIsOn = false;
let mitmwebprocess;
let mitmproxyclient;
let pyodide;
let selectRules;

function sendLogToRenderer(log, isErr) {
    if (win == null) return;
    win.webContents.send("log", { log: log, isErr: isErr });
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

    if (env.settings.updateBinary) {
        const binaryUpdater = new BinaryUpdater(env.paths, win);
        const ffmpegUpdater = new FfmpegUpdater(env.paths, win);
        const mitmproxyUpdater = new MitmProxyUpdater(env.paths, win);
        win.webContents.send("binaryLock", { lock: true, placeholder: `Checking for a new version of ffmpeg...` })
        ffmpegUpdater.checkUpdate().finally(() => {
            win.webContents.send("binaryLock", { lock: true, placeholder: `Checking for a new version of yt-dlp...` })
            binaryUpdater.checkUpdate().finally(() => {
                win.webContents.send("binaryLock", { lock: false });
                mitmproxyUpdater.checkUpdate().finally(() => {
                    taskList.load();
                    clipboardWatcher.startPolling();
                });
            });
        });
    } else if (env.settings.taskList) {
        taskList.load();
    }

    //Send the saved download type to the renderer
    win.webContents.send("videoAction", { action: "setDownloadType", type: env.settings.downloadType });

    env.errorHandler = new ErrorHandler(win, queryManager, env);

    if (appStarting) {
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
            if (args === 1) {
                if (process.platform === "darwin") app.dock.bounce();
                else win.flashFrame(true);
                win.setProgressBar(-1);
            }
        });

        ipcMain.handle('settingsAction', (event, args) => {
            switch (args.action) {
                case "get":
                    return env.settings.serialize();
                case "save":
                    env.settings.update(args.setting);
                    break;
                case "reset":
                    env.settings = new Settings(env.paths, env);
                    env.settings.setupAdvancedConfig();
                    env.settings.setupMitmproxyConfig();
                    break;
            }
        })

        let appUpdater = new AppUpdater(env, win);
        env.appUpdater = appUpdater;
        if (!env.paths.appPath.includes("\\AppData\\Local\\Temp\\") && !env.paths.appPath.includes("WindowsApps")) {
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
                case "remove":
                    queryManager.removeDownload(args.identifier);
                    break;
                case "open":
                    queryManager.openVideo(args);
                    break;
                case "download":
                    if (args.downloadType === "all") queryManager.downloadAllVideos(args)
                    else if (args.downloadType === "unified") queryManager.downloadUnifiedPlaylist(args);
                    else if (args.downloadType === "single") queryManager.downloadVideo(args);
                    break;
                case "entry":
                    queryManager.manage(args.url, args.headers ? args.headers : []);
                    break;
                case "info":
                    queryManager.showInfo(args.identifier);
                    break;
                case "changeHeaders":
                    queryManager.changeHeaders(args.identifier, args.newheaders);
                    break;
                case "retry":
                    queryManager.retry(args.identifier);
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
    if (process.argv[2] === '--dev') {
        win.webContents.openDevTools()
    }
    win.loadFile(path.join(__dirname, "renderer/renderer.html"))
    win.on('closed', () => {
        if (scannerIsOn) {
            try {
                mitmproxyclient.write('exit');
            } catch (e) {
                console.error(e);
            }
        }
        win = null
    });
    win.once('focus', () => {
        win.flashFrame(false)
    });
    win.webContents.on('did-finish-load', () => {
        win.show();
        startCriticalHandlers(env);
    });
}

app.on('ready', async () => {
    app.setAppUserModelId("com.mp3butcher.youtube-dl-gui");
    env = new Environment(app);
    await env.initialize();
    let baseappdir = app.isPackaged ? path.dirname(env.paths.packedPrefix) : app.getAppPath();
    let pyodidepath = app.isPackaged ?  path.join(baseappdir,'resources/pyodide/') : path.join(baseappdir,'node_modules/pyodide');
    let somepackages = [
        "certifi-2024.2.2-py3-none-any.whl","charset_normalizer-3.3.2-py3-none-any.whl",
        "construct-2.8.8-py2.py3-none-any.whl","idna-3.6-py3-none-any.whl",
        "packaging-23.2-py3-none-any.whl","protobuf-4.24.4-cp312-cp312-emscripten_3_1_52_wasm32.whl",
        "pycryptodome-3.20.0-cp35-abi3-emscripten_3_1_52_wasm32.whl","pymp4-1.4.0-py3-none-any.whl",
        "pyodide_http-0.2.1-py3-none-any.whl",
        "pywidevine-1.8.0-py3-none-any.whl",
        "requests-2.31.0-py3-none-any.whl",
        "urllib3-2.2.1-py3-none-any.whl"
    ].map(e=>path.join(baseappdir,"resources/libs/wheels/")+e)
    pyodide = await Pyodide.loadPyodide({indexURL: pyodidepath, packages: somepackages});

    try {
        let da3 = fs.readFileSync('resources/virtual_device.wvd', { encoding: "binary" })
        let buf = Buffer.from(da3, 'binary')
        pyodide.FS.writeFile("/device.wvd", buf, { encoding: "binary" });
    } catch (e) {
        console.error('no virtual devices detected in binaries directory : please consider donation')
    }

    fs.readFile(path.join(baseappdir, 'resources/selectRules.conf'), 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
        selectRules = data;
        selectRules = selectRules.replace(/\n^\s*$|\s*\/\/.*|\s*$/gm, "");
        selectRules = selectRules.split("\n").map(row => row.split("$$"));

    });

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

const regexDash = /(?:<\?.*>\n*)*<MPD/gi;
const regexprange = /bytes\s*=?(\d+)-(\d+)?\/?(\d+)?/g;
let lastwdurl='';
let lastwdheader='';
let pssh='';
let reqlicHeaders='';
const regspotpssh=/"pssh"\s*:\s*"([^"]*)/g
const regexwd=/[\s.]*<ContentProtection[^>]*VINE">[\s.]*<cenc:pssh[^>]*>(.*)<\/cenc:pssh[^>]*>[\s.]*<\/ContentProtection[^>]*>/g
const regexcenc=/[\s.]*<ContentProtection[^>]*>[\s.]*<cenc:pssh[^>]*>(.*)<\/cenc:pssh[^>]*>[\s.]*<\/ContentProtection[^>]*>/g
let currentkeys='', lastposturl=''//eslint-disable-line no-unused-vars

///Used by pyodide
corsFetch = (u, m, h, b) => {  //eslint-disable-line no-unused-vars, no-implicit-globals, no-undef
    return new Promise((resolve, reject) => {
        let res = fetch(u, {
            method: m,
            headers: JSON.parse(h),
            body: Uint8Array.from(atob(b), c => c.charCodeAt(0))
        })
        .then((r) => r.arrayBuffer())
        .then((r) => {
            let licenseresp = String.fromCharCode(...new Uint8Array(r));
            console.error(licenseresp)
            resolve(btoa(licenseresp));
        })
        if (!res) reject(res)
    })

}

function setVideoKey(u, h, v, ms) {
    let vid = queryManager.getVideoByUrlHeaders(u, h);
    if(vid) vid.keys = v;
    else setTimeout(setVideoKey, ms, u, h, v, ms);
}

function keyFound(result) {
    console.log("!!!!!!!!!!!!!!Key Found!!!!!!!!!!\n" + result);
    console.warn(globalThis.zechallenge.toString());
    currentkeys = result;

    if(lastwdurl!='') {
        //Find the video and attach key the video
        queryManager.manage(lastwdurl, lastwdheader);
        setVideoKey(lastwdurl, lastwdheader, result, 2000)
        lastwdurl = false;
    }
}

function scanPostRequest(data) {
    console.log("checking POST for licence")
    for (let licrule of selectRules) {
        let arr = []
        arr.push(data.url)
        let search = arr.findIndex(e => e.includes(licrule[0]));
        if (search >= 0) {
            //Sounds like we have a winner
            if (data.response == '') {
                ///Get headers of the original request
                let blacked = ["content-length", "Origin", "Sec-Fetch-Mode", "Sec-Fetch-Dest", "Sec-Fetch-Site", "Referer", "Accept-Encoding", "Accept-Language", "Host", "Connection"]
                let idx = 0, removed = false;
                while (idx < data.headers.length) {
                    for (let idx2 = 0; idx2 < blacked.length; idx2++) {
                        if (data.headers[idx].k.toLowerCase() == blacked[idx2].toLowerCase()) {
                            data.headers.splice(idx, 1);
                            removed = true;
                            break;
                        }
                    }
                    if (!removed) idx++;
                    removed = false;
                }
                reqlicHeaders = JSON.stringify(Object.fromEntries(data.headers.map(header => [header.k, header.v])))
                break;
            }
            console.log(licrule[1]);
            if (licrule[1]) lastposturl = data.url;
            if (pssh != '') {
                console.log("POST fit registered licence server")
                let idx = 0, removed = false;
                while (idx < data.headers.length) {

                    if (data.headers[idx].k.toLowerCase() == 'content-length') {
                        data.headers.splice(idx, 1);
                        removed = true;
                    }

                    if (!removed) idx++;
                    removed = false;
                }
                let licHeaders = JSON.stringify(Object.fromEntries(data.headers.map(header => [header.k, header.v]))) //eslint-disable-line no-unused-vars
                pyodide.globals.set("pssh", pssh);
                pyodide.globals.set("licUrl", data.url);
                pyodide.globals.set("licHeaders", reqlicHeaders);
                pyodide.globals.set("licBody", data.requestbody);

                globalThis.zechallenge = '';

                let baseappdir = app.isPackaged ? path.dirname(env.paths.packedPrefix) : app.getAppPath();
                let pre = fs.readFileSync(path.join(baseappdir,'resources/pre.py'), { encoding: 'utf8', flag: 'r' });
                let after = fs.readFileSync(path.join(baseappdir,'resources/after.py'), { encoding: 'utf8', flag: 'r' });
                let scheme = fs.readFileSync(path.join(baseappdir,'resources/schemes/') + (licrule[1] ? licrule[1] : 'CommonWV') + '.py', { encoding: 'utf8', flag: 'r' });
                //Get result

                console.log("call virtual python")
                try {
                    pyodide.runPythonAsync([pre, scheme, after].join("\n")).then(keyFound)
                } catch (e) {
                    console.error(e);
                }
            }
            break;
        }
    }
}

function scan(msg) {
    if (scannerIsOn) {
        let data;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            return console.error(e); //Error in the above string (in this case, yes)!
        }

        //Filter unwanted headers
        let idx = 0, removed = false;
        while(idx<data.headers.length){
            for(let idx2=0; idx2 < env.settings.headerFilter.length; idx2++) {
                if(data.headers[idx].k.toLowerCase() == env.settings.headerFilter[idx2]) {
                    data.headers.splice(idx,1);
                    removed = true;
                    break;
                }
            }
            if(!removed) idx++;
            removed = false;
        }

        //Basic scanner
        let sizeok = false;   //Check if range is not prohibitively small
        let contentype = "";
        let contentlength = 0;
        let headerstr = '';

        data.headers.forEach(h => {
            headerstr = headerstr + h.k + ": " + h.v + '$';
            if (h.k.toLowerCase() == "range") {
                const ranges = [...h.v.matchAll(regexprange)];
                console.log(ranges[0]);
                if (typeof (ranges[0][1]) == "undefined") contentlength = 20000000;
                else contentlength = parseInt(ranges[0][2], 10) - parseInt(ranges[0][1], 10);
                if (contentlength > 1500000) sizeok = true;
            }
        });
        console.log(" scan url " + data.url + " headers:" + headerstr);
        if (data.method == 'POST') {
            scanPostRequest(data)

        }


        data.rheaders.forEach(h => {
            if (h.k.toLowerCase() == "content-type") contentype = h.v;
            if (h.k.toLowerCase() == "content-length") {
                contentlength = parseInt(h.v, 10);
            }
            if (h.k.toLowerCase() == "content-range") {

                const ranges = [...h.v.matchAll(regexprange)];
                if (typeof (ranges[0][1]) == "undefined") contentlength = 20000000;
                else contentlength = parseInt(ranges[0][2], 10) - parseInt(ranges[0][1], 10);
                if (contentlength > 1500000) sizeok = true;
            }
        });
        let toscandeeply = false;
        //Large Content-type video
        if (contentype.startsWith('video') && contentlength > 1500000) {
            toscandeeply = true;
            console.warn(" [x] contentype video!!!!!!!!!!!" + data);
        }
        //Large Content-Range
        if(!contentype.startsWith('image') && (sizeok || contentlength >  1500000)) {
            toscandeeply = true;
        }
        let res = atob(data.response)
        console.log(" [x] response  " + res.substring(0, 100));
        if (res.length > 1) {
            //Spotify pssh            https://seektables.scdn.co/seektable/file_id.json "pssh":"cap"
            if(data.url.startsWith('https://seektables.scdn.co/seektable/')) {
                const wd = [...res.matchAll(regspotpssh)];
                console.log(wd[0]);
                if (typeof (wd[0]) != "undefined") pssh = wd[0][1];

            }
            //Spotify stream            https://audio-ak.spotifycdn.com/audio
            if(data.url.startsWith('https://audio-ak.spotifycdn.com/audio')) {
                idx = 0;
                removed = false;
                while(idx<data.headers.length) {
                        if(data.headers[idx].k.toLowerCase() == 'range') {
                            data.headers.splice(idx,1);
                            removed = true;
                        }
                    if(!removed) idx++;
                    removed = false;
                }
                if(currentkeys!=''){
                    //Delay to be sure to have key returned lastwdurl = data.url; lastwdheader = data.headers
                    toscandeeply = true;
                    let ckey = currentkeys
                    setVideoKey(data.url, data.headers, ckey, 2000);
                    currentkeys = ''
                }
            }
            if (res[0] == "#") { //HLS?
                console.log(res);
                toscandeeply = true;
            } else if (res.match(regexDash)) { //DASH?
                console.log(res);
                pssh='';
                ///seek pssh
                const wd = [...res.matchAll(regexwd)];
                console.log(wd[0]);
                if (typeof (wd[0]) != "undefined") {
                    let bestqkey = 0; //Have to find a way to get desired stream
                    console.log(wd[bestqkey]);
                    pssh = wd[bestqkey][1];
                    lastwdurl = data.url;
                    lastwdheader = data.headers
                }else{
                    const cenc = [...res.matchAll(regexcenc)];
                    console.log(cenc[0]);
                    if (typeof (cenc[0]) != "undefined") {
                        console.log(cenc[0]);
                        pssh = cenc[0][1];
                        lastwdurl = data.url;
                        lastwdheader = data.headers
                    } else toscandeeply = true;
                }
            }
        }
        if (toscandeeply) queryManager.manage(data.url, data.headers);
    }
}

//Recursive connection try for non blocking connection
function createConnection() {
    //Connection to mitmproxy on tcp
    mitmproxyclient = new net.Socket();
    mitmproxyclient.connect(12000, '127.0.0.1', () => {
        console.log('Connected to mitmproxy');
    });
    mitmproxyclient.on('data', scan);
    mitmproxyclient.on('error', () => {
        if (scannerIsOn) createConnection(); //Retry to connect until it's accepted
    });
    mitmproxyclient.on('close', () => {
        console.log('Connection to mitmproxy closed');
    });
}

//Set Traffic Scanner On/off
ipcMain.handle("setScannerEnabled", (event, args) => {
    console.log("set Network Scanning =" + args);

    scannerIsOn = args.value;
    const spawn = require('child_process').spawn;

    console.log(env.settings.paths.mitmproxy);
    if (scannerIsOn) {
        if (mitmproxyclient) mitmproxyclient.destroy();
        console.log(__dirname);
        let script = path.join(path.dirname(__dirname), 'binaries', 'send_traffic_to_videodownloader.py');
        console.log(script);
        let port = env.settings.mitmPort;
        let extra = env.settings.mitmExtraArgs;
        extra = extra.split(' ');
        mitmwebprocess = spawn(
            path.join(env.settings.paths.mitmproxy, 'mitmweb'),
            ['-q', '-s', script, '--listen-port', port].concat(extra)
        );
        mitmwebprocess.on('message', (message) => {
            if (message.type === 'error') {
                console.error('Child process error:', message.error);
            }
        });
        mitmwebprocess.on('uncaughtException', (err) => {
            console.error('SubProcessProxy uncaughtException', err);
        });
        mitmwebprocess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        mitmwebprocess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        mitmwebprocess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
        dialog.showMessageBox({ message: 'Proxy running on localhost on port '+env.settings.mitmPort+': Configure proxy in your browser to scan network' });
        createConnection();

    } else {
        try {
            //Sending something will terminate both connection and server process
            mitmproxyclient.write('exit');
            mitmproxyclient = null;
        } catch (e) {
            console.log(e);
        }
    }
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
    if (arg === 'close') {
        win.close()
    } else if (arg === "minimize") {
        win.minimize()
    } else if (arg === "maximize") {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
})

//Show a dialog to select a folder, and return the selected value.
ipcMain.handle('downloadFolder', async () => {
    await dialog.showOpenDialog(win, {
        defaultPath: env.settings.downloadPath,
        buttonLabel: "Set download location",
        properties: [
            'openDirectory',
            'createDirectory'
        ]
    }).then(result => {
        if (result.filePaths[0] != null) {
            env.settings.downloadPath = result.filePaths[0];
            env.settings.save();
        }
    });
});

//Show a dialog to select a file, and return the selected value.
ipcMain.handle('cookieFile', async (event, clear) => {
    if (clear === true) {
        env.settings.cookiePath = null;
        env.settings.save();
        return;
    } else if (clear === "get") {
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
    if (result.filePaths[0] != null) {
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

