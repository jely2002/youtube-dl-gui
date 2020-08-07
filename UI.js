//UI.js manages all Jquery and UI related tasks
'use strict'
const customTitlebar = require('custom-electron-titlebar')
const Menu = remote.Menu;

let stepper
let downloadPath = remote.app.getPath('downloads');

//Sets the custom titlebar per platform
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
    //Initiates the stepper (main UI)
    stepper = new Stepper($('.bs-stepper')[0], {
       linear: true,
       animation: true
    })
    //Configures the 3 error toasts
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
    //Set the default directory for the download location input
    $("#directoryInputLabel").html(remote.app.getPath('downloads'))

    //Limits the playlist video selector to the size of the playlist and above 0.
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

//Closes toasts when the close button is clicked
$(document).on('click','.close',function (e) {
    $(this).closest('.toast').css('visibility','hidden')
});

//Sets the download directory to the directory selected in the input
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

//Shows a warning toast, no customisable message
function showWarning() {
    $('#warning').toast('show')
    $('#warning').css('visibility','visible')
}

//Shows an error toast, with customisable message
function showError(err) {
    $('.error-body').html(err.toString())
    $('#error').toast('show')
    $('#error').css('visibility','visible')
}

//Creates the input menu to show on right click
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

//Enable right click menu on input/textarea
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

//Sets the text in one of the two progress bars
function setProgressBarText(isMetadata, text, downloaded, toDownload) {
    if(isMetadata) {
        if(downloaded != null && toDownload != null) {
            let transformedText = text.replace('%1', downloaded).replace('%2', toDownload)
            $('.completion.metadata').html(transformedText)
        } else {
            $('.completion.metadata').html(text)
        }
    } else {
        if(downloaded != null && toDownload != null) {
            let transformedText = text.replace('%1', downloaded).replace('%2', toDownload)
            $('.completion.download').html(transformedText)
        } else {
            $('.completion.download').html(text)
        }
    }
}

//Sets the progress (width) of one of the two progress bars
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

//Sets the playlist information after the metadata has been collected
function setPlaylistAdvancedData(playlistVideo) {
    $(".thumbnail").attr("src", playlistVideo.thumbnail)
    $(".thumbnail-settings").attr("src", playlistVideo.thumbnail)
    $(".spinner-border").css("display", "none")
    $('#step-one-btn').prop("disabled", false)
    $('.video-range').css("display", "initial")
}

//Sets initial playlist data (when URL is entered)
function setPlaylistData(metadata, toDownload) {
    $(".title").html("<strong>Playlist name:</strong> " + metadata.title)
    $(".channel").html("<strong>Channel:</strong> " + metadata.uploader)
    $(".duration").html("<strong>Playlist size:</strong> " + toDownload + " videos")
    $('#max').val(toDownload)
}

//Shows error when an invalid playlist link has been given
function setInvalidPlaylist() {
    $('.invalid-feedback').html("This playlist does not exist, is private or is blocked")
    $('#url').addClass("is-invalid").removeClass("is-valid")
    $(".spinner-border").css("display", "none")
    $(".progress.metadata").css("display", "none");
}

//Sets progress bar to "Fetching playlist metadata..."
function setFetchingPlaylist() {
    $(".spinner-border").css("display", "inherit");
    $('.completion.metadata').html("Fetching playlist metadata...")
    $(".progress.metadata").css("display", "inherit");
}

//Check if 'download audio only' is selected
function isAudio() {
    return $('input[name=type-select]:checked').val() === "audio"
}

//Check if 'download subtitles' is selected
function isSubtitleChecked() {
    return $('#subtitles').prop('checked')
}

//Opens the downloaded file specified in downloadPath
function openDownloadedFile() {
    if(isPlaylist) {
        shell.openItem(downloadPath)
    } else {
        if(mediaMode === "audio") {
            if(process.platform === "darwin") {
                shell.showItemInFolder(downloadPath + '/' + audioOutputName.replace(/[//?%*:|"<>]/g, '-'))
            } else {
                shell.showItemInFolder(downloadPath + '\\' + audioOutputName.replace(/[/\\?%*:|"<>]/g, '-'))
            }
        } else {
            if(process.platform === "darwin") {
                shell.showItemInFolder(downloadPath + '/' + videoOutputName.replace(/[//?%*:|"<>]/g, '-'))
            } else {
                shell.showItemInFolder(downloadPath + '\\' + videoOutputName.replace(/[/\\?%*:|"<>]/g, '-'))
            }
        }
    }

}
