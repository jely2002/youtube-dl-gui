'use strict'
window.$ = window.jQuery = require('jquery')
const customTitlebar = require('custom-electron-titlebar')
const Menu = remote.Menu;

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
    $("#quality").on('change', function() {
        if(downloadMode === "audio") return
        let index = availableFormats.indexOf(document.getElementById("quality").options[document.getElementById("quality").selectedIndex].text)
        $('.size').html('<b>Download size: </b>' + formatSizes[index])
    })
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

function setType(type) {
    $("#download-btn").prop("disabled", false)
    $("#directoryInput").prop("disabled", false)
    if(type === "audio") {
        downloadMode = "audio"
        $('#quality').empty().append(new Option("Best", "best")).append(new Option("Worst", "worst")).prop("disabled", false).val("best")
        $('.size').html('<b>Download size: </b>' + audioSize)
    } else if(type === "video") {
        downloadMode = "video"
        $('#quality').empty()
        availableFormats.forEach(function(quality) {
            $('#quality').append(new Option(quality, availableFormatCodes[availableFormats.indexOf(quality)])).prop("disabled", false)
            $('#subtitles').prop("disabled", false)
        })
        $('#quality').val(availableFormatCodes[availableFormatCodes.length-1])
        let index = availableFormats.indexOf(document.getElementById("quality").options[document.getElementById("quality").selectedIndex].text)
        $('.size').html('<b>Download size: </b>' + formatSizes[index])
    }
}

const InputMenu = Menu.buildFromTemplate([{
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
]);

document.body.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let node = e.target;

    while (node) {
        if (node.nodeName.match(/^(input|textarea)$/i) || node.isContentEditable) {
            InputMenu.popup(remote.getCurrentWindow());
            break;
        }
        node = node.parentNode;
    }
});
