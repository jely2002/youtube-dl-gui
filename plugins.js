window.$ = window.jQuery = require('jquery')
const customTitlebar = require('custom-electron-titlebar')

let stepper

new customTitlebar.Titlebar({
    backgroundColor: customTitlebar.Color.fromHex('#000000'),
    maximizable: false,
    shadow: true,
    titleHorizontalAlignment: "left",
    enableMnemonics: false,
    icon: "bin/icon-light.png"
})

$(document).ready(function () {
    stepper = new Stepper($('.bs-stepper')[0], {
       linear: true,
       animation: true
    })
})

function next() {
    stepper.next()
}

function setType(type) {
    if(type === "audio") {
        $('#quality').empty().append(new Option("Best", "best")).append(new Option("Worst", "worst")).prop("disabled", false).val("best")
    } else if(type === "video") {
        $('#quality').empty()
        availableFormats.forEach(function(quality) {
            $('#quality').append(new Option(quality, quality.slice(0,-1))).prop("disabled", false)
        })
        $('#quality').val(availableFormats[availableFormats.length-1].slice(0,-1))
    }
}
