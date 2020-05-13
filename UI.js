'use strict'
const customTitlebar = require('custom-electron-titlebar')
const Menu = remote.Menu;

let stepper
let downloadPath = remote.app.getPath('downloads');

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
    $("#max,#min").keydown(function () {
        if (!$(this).val() || (parseInt($(this).val()) <= parseInt($(this).attr("max")) && parseInt($(this).val()) > 0)) $(this).data("old", $(this).val())
    })
    $("#max,#min").keyup(function () {
        if (!(!$(this).val() || (parseInt($(this).val()) <= parseInt($(this).attr("max")) && parseInt($(this).val()) > 0))) $(this).val($(this).data("old"))
    })
    $("#max, #min").on('input', function() {
        if($("#max").val() === "" || $("#min").val() === "") return
        applyRange()
        updateAvailableFormats()
        if($('input[name=type-select]:checked').val() === "video") {
            $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
        } else {
            $('.size').html('<b>Download size: </b> ~' + getTotalSize())
        }
    });
})

$(document).on('click','.close',function (e) {
    $(this).closest('.toast').css('visibility','hidden')
});

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
    $('#warning').css('visibility','visible')
}

function showError(err) {
    $('.error-body').html(err.toString())
    $('#error').toast('show')
    $('#error').css('visibility','visible')
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

function setProgressBarText(isMetadata, text, downloaded, toDownload) {
    if(isMetadata) {
        if(downloaded != null && toDownload != null) {
            let transformedText = text.replace('%1', downloaded).replace('%2', downloaded)
            $('.completion.metadata').html(transformedText)
        } else {
            $('.completion.metadata').html(text)
        }
    } else {
        if(downloaded != null && toDownload != null) {
            let transformedText = text.replace('%1', downloaded).replace('%2', downloaded)
            $('.completion.download').html(transformedText)
        } else {
            $('.completion.download').html(text)
        }
    }
}

function setProgressBarProgress(isMetadata, downloaded, toDownload) {
    let percentage = ((downloaded/toDownload)*100) + "%"
    if(isMetadata) {
        $('.progress-bar.metadata').css("width", percentage).attr("aria-valuenow", percentage.slice(0, -1))
        if(percentage === 100) {
            remote.getCurrentWindow().setProgressBar(-1, {mode: "none"})
        } else {
            remote.getCurrentWindow().setProgressBar(downloaded / toDownload)
        }
    } else {
        $('.progress-bar.download').css("width", percentage).attr("aria-valuenow", percentage.slice(0, -1))
        if(percentage === 100) {
            remote.getCurrentWindow().setProgressBar(-1, {mode: "none"})
        } else {
            remote.getCurrentWindow().setProgressBar(downloaded / toDownload)
        }
    }
}

function setPlaylistAdvancedData(playlistVideo) {
    $(".thumbnail").attr("src", playlistVideo.thumbnail)
    $(".thumbnail-settings").attr("src", playlistVideo.thumbnail)
    $(".spinner-border").css("display", "none")
    $('#step-one-btn').prop("disabled", false)
    $('.video-range').css("display", "initial")
}

function setPlaylistData(metadata, toDownload) {
    $(".title").html("<strong>Playlist name:</strong> " + metadata.title)
    $(".channel").html("<strong>Channel:</strong> " + metadata.uploader)
    $(".duration").html("<strong>Playlist size:</strong> " + toDownload + " videos")
    $('#max').val(toDownload)
}

function setInvalidPlaylist() {
    $('.invalid-feedback').html("This playlist does not exist, is private or is blocked")
    $('#url').addClass("is-invalid").removeClass("is-valid")
    $(".spinner-border").css("display", "none")
    $(".progress.metadata").css("display", "none");
}

function setFetchingPlaylist() {
    $(".spinner-border").css("display", "inherit");
    $('.completion.metadata').html("Fetching playlist metadata...")
    $(".progress.metadata").css("display", "inherit");
}

function isAudio() {
    return $('input[name=type-select]:checked').val() === "audio"
}

function isSubtitleChecked() {
    return $('#subtitles').prop('checked')
}
