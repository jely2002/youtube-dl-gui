'use strict'
window.$ = window.jQuery = require('jquery')
const fs = require('fs')
const universalify = require('universalify')
const execa = universalify.fromPromise(require('execa'))

let ytdlBinary
let selectedURL
let ffmpegLoc
let timings
let availableVideoFormats = []
let playlistVideos = []
let filteredPlaylistVideos= []
let playlistFormatIDs = []
let isPlaylist = false
let audioFormat
let mediaMode

//Sets all paths to the included binaries depending on the platform
if(process.platform === "darwin") {
    ipcRenderer.invoke('getPath', 'appPath').then((result) => {
        let appPath = result.slice(0,-8)
        ytdlBinary = appPath + "youtube-dl-darwin"
        ffmpegLoc = appPath + "ffmpeg"
        fs.chmod(appPath + "youtube-dl-darwin", 0o755, function(err){
            if(err) console.log(err)
        })
        fs.chmod(appPath + "ffmpeg", 0o755, function(err){
            if(err) console.log(err)
        })
        initCaching()
    })
} else if(process.platform === "linux") {
    ipcRenderer.invoke('getPath', 'home').then((result) => {
        let appPath = result + "/.youtube-dl-gui/"
        ytdlBinary = appPath + "youtube-dl-darwin"
        ffmpegLoc = appPath + "ffmpeg"
        fs.chmod(appPath + "youtube-dl-darwin", 0o755, function(err){
            if(err) console.log(err)
        })
        fs.chmod(appPath + "ffmpeg", 0o755, function(err){
            if(err) console.log(err)
        })
        initCaching()
    })
} else if(process.platform === "win32") {
    ytdlBinary = "resources/youtube-dl.exe"
    ffmpegLoc = "resources/ffmpeg.exe"
    initCaching()
}

//Calls the youtube-dl binary included with this application
function callYTDL (url, args, options = {}, isMetadata, cb) {
    if (process.platform === "win32") {
        args.push('--encoding')
        args.push('utf8')
    }
    let singleRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi
    if(singleRegex.test(url)) {
        args.push("https://" + url.match(singleRegex)[0])
    } else {
        args.push(url)
    }
    args.push("--no-cache-dir")
    if(!isPlaylist) startSingleVideoStatus()
    const executable = execa(ytdlBinary, args, options)
    let metadata = "";
    executable.stdout.on('data', (data) => {
        if(isMetadata) {
            metadata += data.toString().trim().split(/\r?\n/)
        } else if(!isPlaylist) {
            updateSingleVideoStatus(data.toString().trim().split(/\r?\n/))
        }
    })
    executable.on('exit', () => {
        if(!isMetadata) {
            stopSingleVideoStatus()
            return cb(null, null)
        } else {
            resolve(metadata)
        }
    })
}

//Resets UI elements when a URL gets entered, verifies the URL and sends the url on its way.
async function validateLink(url) {
    const singleRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi
    const playlistRegex = /^.*(youtu.be\/|list=)([^#\&\?]*)[a-zA-Z0-9_-]{34}/;
    const channelRegex = /(?:https|http)\:\/\/(?:[\w]+\.)?youtube\.com\/(?:c\/|channel\/|user\/)?([a-zA-Z0-9\-]{1,})/

    availableVideoFormats = []
    playlistVideos = []
    videoURLS = []
    filteredVideoURLS = []
    metaVideos = []
    playlistFormatIDs = []
    filteredPlaylistVideos = []

    if(singleRegex.test(url)) {
        $('#url').addClass("is-valid").removeClass("is-invalid")
        isPlaylist = false
        getMetadata(url)
    } else if(playlistRegex.test(url)) {
        $('#url').addClass("is-valid").removeClass("is-invalid")
        isPlaylist = true
        getPlaylistMetadata(url, false)
    } else if(channelRegex.test(url)) {
        $('#url').addClass("is-valid").removeClass("is-invalid")
        $('.channelInfo').css("display", "initial")
        getPlaylistMetadata(await getChannelVideoPlaylist(url), true)
        $('.channelInfo').css("display", "none")
        isPlaylist = true
    } else {
        $('.invalid-feedback').html("Please enter a valid YouTube URL")
        $('#url').addClass("is-invalid").removeClass("is-valid")
        $('#step-one-btn').prop("disabled", true)
        $('.progress.metadata').css("display", "none")
        $('.progress-bar.metadata').css("width", "0%").attr("aria-valuenow", "0")
    }
}

//Starts download with the selected options, starts error timing
function download() {
    applyRange()
    let videoQuality = $('#videoquality').val()
    let audioQuality = $('#audioquality').val()
    timings = setTimeout(showWarning, 90000)
    stepper.next()
    if(isPlaylist) {
        downloadPlaylist(audioQuality)
        clearTimeout(timings)
        $('#open-btn').html("Open playlist")
        $('.progress').css("display", "initial")
    } else {
        if (mediaMode === "video") {
            downloadVideo(videoQuality, audioQuality)
        } else {
            downloadAudio(audioQuality)
        }
    }
}

//Clears error timing and sets the UI to the 'download finished' state.
function downloadFinished() {
    clearTimeout(timings)
    $('.circle-loader').toggleClass('load-complete')
    $('.checkmark').toggle()
    $('#reset-btn').html("Download another video").prop("disabled", false)
    $('#open-btn').prop("disabled", false)
    ipcRenderer.invoke('updateProgressBar', 'hide')
    if(process.platform === "win32") ipcRenderer.invoke('setOverlayIcon', {mode: "done"})
}

//Sets the selected download type (playlist, single video), and configures UI elements accordingly.
function setType(type) {
    $("#directoryInput,#download-btn,#min,#max").prop("disabled", false)
    mediaMode = type
    if(isPlaylist) {
        applyRange()
        if(type === "video") {
            $('#videoquality').empty()
            $('#videoquality').css("display", "initial");
            availableVideoFormats.forEach(function (format) {
                if(format.format_note !== "DASH video") {
                    $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
                    $('#videoquality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
                    $('#subtitles').prop("disabled", false)
                }
            })
            $('#videoquality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
            $('#audioquality').empty().append(new Option("Best audio", "best")).append(new Option("Worst audio", "worst")).prop("disabled", false).val("best")
            $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
        } else {
            $('#audioquality').empty().append(new Option("Best audio", "best")).append(new Option("Worst audio", "worst")).prop("disabled", false).val("best")
            $('#videoquality').css("display", "none");
            $('.size').html('<b>Download size: </b>' + '~' + getTotalSize())
        }
    } else if (type === "video") {
        $('#videoquality').empty()
        $('#videoquality').css("display", "initial");
        availableVideoFormats.forEach(function (format) {
            if(format.format_note === "DASH video") {
                let note
                if(format.fps === 30 || format.fps === 24|| format.fps === 29) {
                   note = format.height + "p"
                } else {
                    note = format.height + "p" + format.fps
                }
                $('#videoquality').append(new Option(note, format.format_id)).prop("disabled", false)
                $('.size').html('<b>Download size: </b>' + "DASH")
            } else {
                $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
                $('#videoquality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
            }
            $('#subtitles').prop("disabled", false)
        })
        $('#videoquality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
        $('#audioquality').empty().append(new Option("Best audio", "best")).append(new Option("Worst audio", "worst")).prop("disabled", false).val("best")
    } else {
        if(audioFormat.format_note === "DASH audio") {
            $('.size').html('<b>Download size: </b>DASH')
        } else {
            $('.size').html('<b>Download size: </b>' + '~' + getTotalSize())
        }
        $('#audioquality').empty().append(new Option("Best audio", "best")).append(new Option("Worst audio", "worst")).prop("disabled", false).val("best")
        $('#videoquality').css("display", "none");
    }
}

//Calculates the total download size for the selected video formats and range
function getTotalSize(videoQuality) {
    playlistFormatIDs = []
    if(isPlaylist) {
        if(mediaMode === "video") {
            let sum = 0
            filteredPlaylistVideos.forEach(function (video) {
                if(video.removed === "yes") {
                    playlistFormatIDs.push("0")
                    return
                }
                let filteredFormats = []
                video.formats.forEach(function (format) {
                    let includes
                    if (format.ext === "m4a") {
                        sum += format.filesize
                    } else if (format.format_note !== "tiny") {
                        filteredFormats.forEach(function (filteredFormat) {
                            if (format.format_note === filteredFormat.format_note) includes = true
                        })
                        if (!includes) filteredFormats.push(format)
                    }
                })
                let gotFormatMatch = false
                filteredFormats.forEach(function (filteredFormat) {
                    if (filteredFormat.format_note === videoQuality) {
                        sum += filteredFormat.filesize
                        playlistFormatIDs.push(filteredFormat.format_id)
                        gotFormatMatch = true
                    }
                })
                if (!gotFormatMatch) {
                    let gotIndirectMatch = false
                    filteredFormats.reverse().forEach(function (format) {
                        if (!gotIndirectMatch) {
                            availableVideoFormats.forEach(function (availableFormat) {
                                if (availableFormat.format_note === format.format_note) {
                                    sum += format.filesize
                                    playlistFormatIDs.push(format.format_id)
                                    gotIndirectMatch = true
                                }
                            })
                        }
                    })
                }
            })
            return (sum / 1.049e+6).toFixed(1) + " MB"
        } else {
            let sum = 0
            filteredPlaylistVideos.forEach(function (video) {
                if(video.removed === "yes") return
                video.formats.forEach(function (format) {
                    if (format.ext === "m4a") {
                        sum += format.filesize
                    }
                })
            })
            return (sum / 1.049e+6).toFixed(1) + " MB"
        }
    } else {
        let sum = 0
        sum += audioFormat.filesize
        if (mediaMode === "video") {
            availableVideoFormats.forEach(function(format) {
                if (format.format_note === videoQuality) {
                    sum += format.filesize
                }
            })
        }
        return (sum / 1.049e+6).toFixed(1) + " MB"
    }
}

//Refreshes the UI and filtredPlaylistVideos when the quality gets changed
$(document).ready(function () {
    $("#videoquality").on('change', function () {
        if (mediaMode === "audio") return
        let selected = document.getElementById("videoquality").options[document.getElementById("videoquality").selectedIndex].text
        applyRange()
        if($('.size').html() !== '<b>Download size: </b>DASH') {
            $('.size').html('<b>Download size: </b>' + getTotalSize(selected))
        }
    })
})

//Moves the stepper to the settings step
function settings() {
    stepper.next()
    selectedURL = $("#url").val()
    $('#max').attr("max", playlistVideos.length).val(playlistVideos.length)
    $('#min').attr("max", playlistVideos.length)
    if(isPlaylist) {
        $('.video-range').css("display", "initial")
    } else {
        $('.video-range').css("display", "none")
    }
}

//Applies the selected range to playlistVideos, and outputs the results to filteredPlaylistVideos
function applyRange() {
   let max = parseInt($('#max').val())
   let min = parseInt($('#min').val())
    if(max > min) {
        let tempArr = playlistVideos.slice(0)
        tempArr.length = max
        tempArr.splice(0, min - 1)
        filteredPlaylistVideos = tempArr.slice(0)
    } else if(max < min) {
        let tempArr = playlistVideos.slice(0)
        tempArr.length = min
        tempArr.splice(0, max - 1)
        filteredPlaylistVideos = tempArr.slice(0)
    } else {
        filteredPlaylistVideos = [playlistVideos[min - 1]]
    }
}

//Updates the available video formats for all videos in filteredPlaylistVideos
function updateAvailableFormats() {
    availableVideoFormats = []
    filteredPlaylistVideos.forEach(function(video) {
        if(video.removed === "yes") {
            return
        }
        video.formats.forEach(function (format) {
            if (format.format_note !== "tiny") {
                let alreadyIncludes
                availableVideoFormats.forEach(function (savedFormat) {
                    if (savedFormat.format_note === format.format_note) alreadyIncludes = true
                })
                if (!alreadyIncludes) {
                    availableVideoFormats.push(format)
                }
            }
        })
    })
    if(mediaMode !== "audio") {
        $('#videoquality').empty()
        availableVideoFormats.forEach(function (format) {
            $('#videoquality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
        })
        $('#videoquality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
    }
}

//Resets all the variables and UI elements
function resetSteps() {
    selectedURL = ""
    availableVideoFormats = []
    playlistFormatIDs = []
    playlistVideos = []
    filteredPlaylistVideos = []
    videoURLS = []
    filteredVideoURLS = []
    metaVideos = []
    isPlaylist = false
    audioFormat = ""
    mediaMode = ""
    $('#url').removeClass("is-valid").removeClass("is-invalid")
    $(".thumbnail").attr("src", "./web-resources/waiting-for-link.png")
    $(".title").html("<strong>Title:</strong> --").css("display", "block")
    $(".channel").html("<strong>Channel:</strong> --").css("display", "block")
    $(".duration").html("<strong>Duration:</strong> --")
    $(".size").html("<strong>Download size:</strong> --")
    $('.main-input').trigger('reset')
    $('.circle-loader').toggleClass('load-complete')
    $('.checkmark').toggle()
    $('#reset-btn').html("Downloading...").prop("disabled", true)
    $('#open-btn').prop("disabled", true)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#videoquality').empty().append(new Option("Select video quality", "quality")).prop("disabled", true).val("quality")
    $('#audioquality').empty().append(new Option("Select audio quality", "quality")).prop("disabled", true).val("quality")
    $("#directoryInput,#download-btn,#min,#max,#step-one-btn").prop("disabled", true)
    $('.progress-bar').css("width", "0%").attr("aria-valuenow", "0")
    $('.progress').css("display", "none")
    $('.video-range').css("display", "none")
    $('#open-btn').html("Open file")
    if(process.platform === "win32") ipcRenderer.invoke('setOverlayIcon', {mode: "hide"})
    stepper.reset()
}

function resetBack() {
    stepper.reset()
    $('#video,#audio').prop("checked", false)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#videoquality').empty().append(new Option("Select video quality", "quality")).prop("disabled", true).val("quality")
    $("#directoryInput,#download-btn,#min,#max").prop("disabled", false)
    $('.video-range').css("display", "none")
    $(".size").html("<strong>Download size:</strong> --")
}
