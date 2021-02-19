const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
    "main", {
        invoke: async (channel, data) => {
            let validChannels = ["platform", "messageBox","errorReport", "titlebarClick", "openInputMenu", "settingsAction", "videoAction", "cookieFile", "downloadFolder"];
            if (validChannels.includes(channel)) {
                return await ipcRenderer.invoke(channel, data);
            }
        },
        receive: (channel, cb) => {
            let validChannels = ["log", "error", "toast", "maximized", "videoAction", "updateGlobalButtons"];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, arg) => {
                    cb(arg)
                });
            }
        }
    }
);
