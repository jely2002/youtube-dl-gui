const { app, BrowserWindow } = require('electron')
let win

function createWindow () {
    app.allowRendererProcessReuse = true

    win = new BrowserWindow({
        show: false,
        width: 800, //850
        height: 500, //550
        resizable: false,
        frame: false,
        icon: "bin/icon-light.png",
        webPreferences: {
            nodeIntegration: true
        }
    })

    win.removeMenu()
    //win.webContents.openDevTools()
    win.loadFile('index.html')
    win.on('closed', () => {
        win = null
    })

    win.once('ready-to-show', () => {
        win.show()
    })
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
});
