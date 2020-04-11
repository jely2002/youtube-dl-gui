'use strict'
const {remote} = require('electron')
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

// ***BINARY/PATH METHODS*** //
if(process.platform === "darwin") {
    let appPath = remote.app.getAppPath().slice(0, -8)
    ytdlBinary = appPath + "youtube-dl-darwin"
    ffmpegLoc = appPath + "ffmpeg"
    fs.chmod(appPath + "youtube-dl-darwin", 0o755, function(err){
        if(err) showError(err)
    })
    fs.chmod(appPath + "ffmpeg", 0o755, function(err){
        if(err) showError(err)
    })
} else {
    ytdlBinary = "resources/youtube-dl.exe"
    ffmpegLoc = "resources/ffmpeg.exe"
}

function callYTDL (url, args, options = {}, cb) {
    if (process.platform === "win32") {
        args.push('--encoding')
        args.push('utf8')
    }
    let singleRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi
    if(singleRegex.test(url)) {
        args.push("https://www." + url.match(singleRegex)[0])
    } else {
        args.push(url)
    }
    args.push('--youtube-skip-dash-manifest')
    return execa(ytdlBinary, args, options, function done(err, output) {
        if (err) return cb(err)
        return cb(null, output.stdout.trim().split(/\r?\n/))
    })
}

// ***URL METHODS*** //
function url_entered() {
    let url = $("#url").val()
    if(validate(url) === "single") {
        availableVideoFormats = []
        playlistVideos = []
        playlistFormatIDs = []
        filteredPlaylistVideos = []
        isPlaylist = false
        showInfo(url)
        $('#url').addClass("is-valid").removeClass("is-invalid")
    } else if(validate(url) === "playlist") {
        availableVideoFormats = []
        playlistVideos = []
        filteredPlaylistVideos = []
        playlistFormatIDs = []
        isPlaylist = true
        showPlaylistInfo(url)
        $('#url').addClass("is-valid").removeClass("is-invalid")
    } else {
        $('.invalid-feedback').html("Please enter a valid YouTube URL")
        $('#url').addClass("is-invalid").removeClass("is-valid")
        $('#step-one-btn').prop("disabled", true)
    }
}

function validate(url) {
    const singleRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi
    const playlistRegex = /^.*(youtu.be\/|list=)([^#\&\?]*)[a-zA-Z0-9_-]{34}/;
    if(singleRegex.test(url)) {
        return "single"
    } else if(playlistRegex.test(url)) {
        return "playlist"
    } else {
        return "none"
    }
}

// ***DOWNLOAD METHODS*** //
function download() {
    applyRange()
    let quality = $('#quality').val()
    timings = setTimeout(showWarning, 90000)
    stepper.next()
    if(isPlaylist) {
        downloadPlaylist(quality)
        clearTimeout(timings)
        $('.progress').css("display", "initial")
    } else {
        if (mediaMode === "video") {
            downloadVideo(quality)
        } else {
            downloadAudio(quality)
        }
    }
}

function downloadFinished() {
    clearTimeout(timings)
    $('.circle-loader').toggleClass('load-complete')
    $('.checkmark').toggle()
    $('#reset-btn').html("Download another video").prop("disabled", false)
}

// ***SETTINGS METHODS*** //
function setType(type) {
    $("#directoryInput,#download-btn,#min,#max").prop("disabled", false)
    mediaMode = type
    if(isPlaylist) {
        applyRange()
        if(type === "video") {
            $('#quality').empty()
            availableVideoFormats.forEach(function (format) {
                $('#quality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
                $('#subtitles').prop("disabled", false)
            })
            $('#quality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
            $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
        } else {
            $('#quality').empty().append(new Option("Best", "best")).append(new Option("Worst", "worst")).prop("disabled", false).val("best")
            $('.size').html('<b>Download size: </b>' + '~' + getTotalSize())
        }
    } else if (type === "video") {
        $('#quality').empty()
        availableVideoFormats.forEach(function (format) {
            $('#quality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
            $('#subtitles').prop("disabled", false)
        })
        $('#quality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
        $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
    } else {
            $('#quality').empty().append(new Option("Best", "best")).append(new Option("Worst", "worst")).prop("disabled", false).val("best")
            $('.size').html('<b>Download size: </b>' + '~' + getTotalSize())
    }
}

// ***HELPER METHODS*** //
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
                        console.log("audio size direct m4a match " + format.filesize)
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

$(document).ready(function () {
    $("#quality").on('change', function () {
        if (mediaMode === "audio") return
        let selected = document.getElementById("quality").options[document.getElementById("quality").selectedIndex].text
        applyRange()
        $('.size').html('<b>Download size: </b>' + getTotalSize(selected))
    })
})

function settings() {
    stepper.next()
    selectedURL = $("#url").val()
    $('#max').attr("max", playlistVideos.length).val(playlistVideos.length)
    $('#min').attr("max", playlistVideos.length)
    if(isPlaylist) $('.video-range').css("display", "initial")
}

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
        $('#quality').empty()
        availableVideoFormats.forEach(function (format) {
            $('#quality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
        })
        $('#quality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
    }
}

// ***RESET METHODS*** //
function resetSteps() {
    selectedURL = ""
    availableVideoFormats = []
    playlistFormatIDs = []
    playlistVideos = []
    filteredPlaylistVideos = []
    isPlaylist = false
    audioFormat = ""
    mediaMode = ""
    $('#url').removeClass("is-valid").removeClass("is-invalid")
    $(".thumbnail").attr("src", "https://via.placeholder.com/640x360?text=%20")
    $(".title").html("<strong>Title:</strong> --")
    $(".channel").html("<strong>Channel:</strong> --")
    $(".duration").html("<strong>Duration:</strong> --")
    $(".size").html("<strong>Download size:</strong> --")
    $('.main-input').trigger('reset')
    $('.circle-loader').toggleClass('load-complete')
    $('.checkmark').toggle()
    $('#reset-btn').html("Downloading...").prop("disabled", true)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#quality').empty().append(new Option("Select quality", "quality")).prop("disabled", true).val("quality")
    $("#directoryInput,#download-btn,#min,#max,#step-one-btn").prop("disabled", true)
    $('.progress-bar').css("width", "0%").attr("aria-valuenow", "0")
    $('.progress').css("display", "none")
    $('.video-range').css("display", "none")
    stepper.reset()
}

function resetBack() {
    stepper.reset()
    $('#video,#audio').prop("checked", false)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#quality').empty().append(new Option("Select quality", "quality")).prop("disabled", true).val("quality")
    $("#directoryInput,#download-btn,#min,#max").prop("disabled", false)
    $('.video-range').css("display", "none")
    $(".size").html("<strong>Download size:</strong> --")
}
