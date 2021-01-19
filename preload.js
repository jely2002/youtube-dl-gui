const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
    "main", {
        invoke: async (channel, data) => {
            let validChannels = ["platform", "titlebarClick", "openInputMenu", "videoAction"];
            if (validChannels.includes(channel)) {
                return await ipcRenderer.invoke(channel, data);
            }
        },
        receive: (channel, cb) => {
            let validChannels = ["log", "toast", "maximized", "videoAction"];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, arg) => {
                    cb(arg)
                });
            }
        }
    }
);
