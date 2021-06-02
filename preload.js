const Sentry = require("@sentry/electron");
const Tracing = require("@sentry/tracing");
const version = require('./package.json').version;
const { contextBridge, ipcRenderer } = require('electron')

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: "youtube-dl-gui@" + version,
    sendDefaultPii: true,
    integrations: [new Tracing.Integrations.BrowserTracing()],
    tracesSampleRate: process.argv[2] === '--dev' ? 1.0 : 0.01,
    environment: process.argv[2] === '--dev' ? "development" : "production",
    autoSessionTracking: true
});

contextBridge.exposeInMainWorld(
    "main",
    {
        invoke: async (channel, data) => {
            let validChannels = [
                "platform",
                "messageBox",
                "errorReport",
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
                "getSelectedSubtitles"
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
                "binaryLock"
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, arg) => {
                    cb(arg)
                });
            }
        }
    }
);
