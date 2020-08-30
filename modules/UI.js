//UI.js manages all Jquery and UI related tasks
'use strict'
const windowbar = require('windowbar')
let stepper
let isConverting = false

//Sets the custom titlebar per platform
if(process.platform === "darwin") {
    let titlebar = new windowbar({'style':'mac', 'dblClickable':false, 'fixed':true, 'title':'YouTube Downloader','dark':true})
        .appendTo(document.body)
} else {
    let titlebar = new windowbar({'style':'win', 'dblClickable':false, 'fixed':true, 'title':'YouTube Downloader','dark':true})
        .appendTo(document.body)
}
$('.windowbar').prepend("<img src='web-resources/icon-light.png' alt='youtube-dl-gui icon' class='windowbar-icon'>")
$('.windowbar-minimize').on('click', (event) => {
    ipcRenderer.invoke('titlebarClick', 'minimize')
})
$('.windowbar-close').on('click', (event) => {
    ipcRenderer.invoke('titlebarClick', 'close')
})
$('.windowbar-maximize').on('click', (event) => {
    event.stopPropagation()
    event.stopImmediatePropagation()
    event.preventDefault()
    $('.windowbar').removeClass('fullscreen')
})

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
    $('#update').toast({
        autohide: false,
        animation: true
    })
    //Set the default directory for the download location input
    $("#directoryInputLabel").html(downloadPath)

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
    ipcRenderer.send('openFolderDialog', downloadPath)

}
ipcRenderer.on('directorySelected', (event, path) => {
    $('#directoryInputLabel').html(path)
    downloadPath = path
})

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

//Enable right click menu on input/textarea
document.body.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let node = e.target;

    while (node) {
        if (node.nodeName.match(/^(input|textarea)$/i) || node.isContentEditable) {
            ipcRenderer.invoke('openInputMenu')
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
            ipcRenderer.invoke('updateProgressBar', 'hide')
        } else {
            ipcRenderer.invoke('updateProgressBar', downloaded / toDownload)
        }
    } else {
        $('.progress-bar.download').css("width", percentage).attr("aria-valuenow", percentage.slice(0, -1))
        if(percentage === 100) {
            ipcRenderer.invoke('updateProgressBar', 'hide')
        } else {
            ipcRenderer.invoke('updateProgressBar', downloaded / toDownload)
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
    $('.invalid-feedback').html("This playlist does not exist, or is blocked in your country.")
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

//Blocks the url box when binary is being updated
function binaryUpdating(isBusy) {
    if(isBusy) {
        $('#url').prop("disabled", true).attr('placeholder', 'The youtube-dl binary is being updated, please wait...')
    } else {
        $('#url').prop('disabled', false).attr('placeholder', 'YouTube link ex. youtube.com/watch?v=dQw4w9WgXcQ');
    }
}

//Opens the downloaded file specified in downloadPath
function openDownloadedFile() {
    if(isPlaylist) {
        shell.openItem(downloadPath)
    } else {
        if(mediaMode === "audio") {
            if(process.platform === "darwin" || process.platform === "linux") {
                shell.showItemInFolder(downloadPath + '/' + audioOutputName.replace(/[//?%*:|"<>]/g, '_'))
            } else {
                shell.showItemInFolder(downloadPath + '\\' + audioOutputName.replace(/[/\\?%*:|"<>]/g, '_'))
            }
        } else {
            if(process.platform === "darwin" || process.platform === "linux") {
                shell.showItemInFolder(downloadPath + '/' + videoOutputName.replace(/[//?%*:|"<>]/g, '_'))
            } else {
                shell.showItemInFolder(downloadPath + '\\' + videoOutputName.replace(/[/\\?%*:|"<>]/g, '_'))
            }
        }
    }
}

//Stop/hide the progress bar for single videos
function stopSingleVideoStatus() {
    $('.completion.download').html("Video downloaded")
}

//Start the progress bar for single videos
function startSingleVideoStatus() {
    $('.completion.download').html("0.0%")
    $('.progress.download').css("display", "initial")
    isConverting = false
}

//Update the statusbar with live data from stdout
function updateSingleVideoStatus(stdout) {
    if(!stdout[0].includes('%') || stdout[0].includes('Destination')) return
    if(stdout[0].includes('100.0%') || stdout[0].includes('100%')) {
        ipcRenderer.invoke('updateProgressBar', 'hide')
        $('.progress-bar.download').css("width", "100%").attr("aria-valuenow", "100")
        if(mediaMode === "video") {
            $('.completion.download').html("Merging audio and video...")
        } else {
            $('.completion.download').html("Extracting audio...")
        }
        isConverting = true
        return
    }
    if(isConverting) return
    let percentage = stdout[0].substr(0, stdout[0].indexOf('%')).substr(stdout[0].indexOf(' ') + 2) + '%'
    $('.progress-bar.download').css("width", percentage).attr("aria-valuenow", percentage.slice(0, -1))
    $('.completion.download').html(percentage)
    ipcRenderer.invoke('updateProgressBar', parseInt(percentage.slice(0, -1)) / 100)
}

//Credentials modal
$('.addBtn').on('click', (element) => {
    if($('#credentialsForm').get(0).reportValidity()) {
        $('#credentialsModal').modal('hide')
        password = $("#passwordInput").val()
        username = $("#emailInput").val()
        credentialsFilled = true
        cookies = false
        if(isPlaylist) {
            showPlaylistInfo($('#url').val())
        } else {
            showInfo($('#url').val())
        }
    }
})

//Cookies modal
function setCookies() {
    $('#cookiesInput').blur();
    ipcRenderer.send('openFileDialog', cookiePath)
}

ipcRenderer.on('fileSelected', (event, path) => {
    $('#cookiesInputLabel').html(path)
    cookiePath = path;
})

$('.addCookiesBtn').on('click', (element) => {
    if($('#cookiesForm').get(0).reportValidity()) {
        $('#cookiesModal').modal('hide')
        cookies = true
        credentialsFilled = false
        if(isPlaylist) {
            showPlaylistInfo($('#url').val())
        } else {
            showInfo($('#url').val())
        }
    }
})

function logOut() {
    cookies = false
    credentialsFilled = false
    cookiePath = ""
    username = ""
    password = ""
    $('.authenticated').css('display', 'none')
    $(".spinner-border").css("display", "none")
    $(".thumbnail").attr("src", "https://via.placeholder.com/640x360?text=%20")
    $(".title").html("<strong>Title:</strong> --")
    $(".channel").html("<strong>Channel:</strong> --")
    $(".duration").html("<strong>Duration:</strong> --")
    $(".size").html("<strong>Download size:</strong> --")
    if($('#url').val().length !== 0) {
        $('#url').addClass("is-invalid").removeClass("is-valid")
        $('.invalid-feedback').html("This video is private, <a class='credentials' data-toggle='modal' data-target='#credentialsModal'>add credentials</a> or add a <a class='credentials' data-toggle='modal' data-target='#cookiesModal'>cookies.txt</a> file to download private video&#39;s.").css("display", "initial")
    } else {
        $('#url').removeClass("is-invalid").removeClass("is-valid")
    }
    $("#directoryInput,#download-btn,#min,#max,#step-one-btn").prop("disabled", true)
}

$(document).on("submit", "form", function(e){
    e.preventDefault();
    return false;
});

ipcRenderer.on('mac-update', (event, update) => {
    if(update.currentVersion !== update.updateInfo.version) {
        $('#update .toast-body').html("Update " + update.updateInfo.releaseName + " is now out. <u style='cursor: pointer;'>Click here</u> to download the latest version on GitHub.")
        $('#update').toast('show').css('visibility', 'visible')
    }
})
