const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
    "main",
    {
        invoke: async (channel, data) => {
            let validChannels = [
                "platform",
                "messageBox",
                "titlebarClick",
                "openInputMenu",
                "openCopyMenu",
                "settingsAction",
                "videoAction",
                "cookieFile",
                "downloadFolder",
                "installUpdate",
                "iconProgress",
                "theme",
                "restoreTaskList",
                "getDoneActions",
                "setDoneAction",
                "getSubtitles",
                "getSelectedSubtitles",
                "getLog",
                "saveLog",
                "setScannerEnabled"
            ];
            if (validChannels.includes(channel)) {
                return await ipcRenderer.invoke(channel, data);
            }
        },
        receive: (channel, cb) => {
            let validChannels = [
                "log",
                "error",
                "toast",
                "maximized",
                "videoAction",
                "updateGlobalButtons",
                "updateLinkPlaceholder",
                "totalSize",
                "binaryLock",
                "addShortcut",
                "downloadShortcut"
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, arg) => {
                    cb(arg)
                });
            }
        }
    }
);
