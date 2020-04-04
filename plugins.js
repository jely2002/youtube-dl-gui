'use strict'
window.$ = window.jQuery = require('jquery')
const customTitlebar = require('custom-electron-titlebar')

let stepper

if(process.platform === "darwin") {
    new customTitlebar.Titlebar({
        backgroundColor: customTitlebar.Color.fromHex('#000000'),
        maximizable: false,
        shadow: true,
        titleHorizontalAlignment: "center",
        enableMnemonics: false,
        icon: "img/icon-light.png"
    })
} else {
    new customTitlebar.Titlebar({
        backgroundColor: customTitlebar.Color.fromHex('#000000'),
        maximizable: false,
        shadow: true,
        titleHorizontalAlignment: "left",
        enableMnemonics: false,
        icon: "img/icon-light.png"
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
})

function setType(type) {
    $("#download-btn").prop("disabled", false)
    if(type === "audio") {
        $('#quality').empty().append(new Option("Best", "best")).append(new Option("Worst", "worst")).prop("disabled", false).val("best")
    } else if(type === "video") {
        $('#quality').empty()
        availableFormats.forEach(function(quality) {
            $('#quality').append(new Option(quality, quality)).prop("disabled", false)
            $('#subtitles').prop("disabled", false)
        })
        $('#quality').val(availableFormats[availableFormats.length-1])
    }
}
