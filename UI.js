'use strict'
const customTitlebar = require('custom-electron-titlebar')

let stepper
let downloadPath = remote.app.getPath('downloads');
let downloadMode

if(process.platform === "darwin") {
    new customTitlebar.Titlebar({
        backgroundColor: customTitlebar.Color.fromHex('#212121'),
        maximizable: false,
        shadow: false,
        titleHorizontalAlignment: "center",
        enableMnemonics: false,
        icon: "web-resources/icon-light.png"
    })
} else {
    new customTitlebar.Titlebar({
        backgroundColor: customTitlebar.Color.fromHex('#000000'),
        maximizable: false,
        shadow: true,
        titleHorizontalAlignment: "left",
        enableMnemonics: false,
        icon: "web-resources/icon-light.png"
    })
}

$(document).ready(function () {
    stepper = new Stepper($('.bs-stepper')[0], {
       linear: true,
       animation: true
    })
    $('#error').toast({
        autohide: false,
        animation: true
    })
    $('#warning').toast({
        autohide: false,
        animation: true
    })
    $('#connection').toast({
        autohide: false,
        animation: true
    })
    $("#directoryInputLabel").html(remote.app.getPath('downloads'))
})

function setDirectory() {
    $('#directoryInput').blur();
    let path = remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        defaultPath: downloadPath,
        properties: [
            'openDirectory',
            'createDirectory'
        ]
    }).then(result => {
        $('#directoryInputLabel').html(result.filePaths[0])
        downloadPath = result.filePaths[0]
    })
}

function showWarning() {
    $('#warning').toast('show')
}

function showError(err) {
    $('.error-body').html(err.toString())
    $('#error').toast('show')
}
