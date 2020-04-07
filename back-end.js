'use strict'
const youtubedl = require('youtube-dl')
const {remote} = require('electron')
window.$ = window.jQuery = require('jquery')
const fs = require('fs')

//global
let selectedURL
let ffmpegLoc
let timings

//download
let availableVideoFormats = []
let playlistVideos = []
let playlistFormatIDs = []
let audioFormat
let mediaMode

if(process.platform === "darwin") {
    let appPath = remote.app.getAppPath().slice(0, -8)
    youtubedl.setYtdlBinary(appPath + "youtube-dl-darwin")
    ffmpegLoc = appPath + "ffmpeg"
    fs.chmod(appPath + "youtube-dl-darwin", 0o755, function(err){
        if(err) console.log(err)
    })
    fs.chmod(appPath + "ffmpeg", 0o755, function(err){
        if(err) console.log(err)
    })
} else {
    youtubedl.setYtdlBinary("resources/youtube-dl.exe")
    ffmpegLoc = "resources/ffmpeg.exe"
}


function settings() {
    stepper.next()
    selectedURL = $("#url").val()
}

// URL METHODS

function url_entered() {
    let url = $("#url").val()
    if(validate(url) === "single") {
        availableVideoFormats = []
        playlistVideos = []
        playlistFormatIDs = []
        showInfo(url)
        $('#url').addClass("is-valid").removeClass("is-invalid")
    } else if(validate(url) === "playlist") {
        availableVideoFormats = []
        playlistVideos = []
        playlistFormatIDs = []
        mediaMode = "playlist"
        showPlaylistInfo(url)
        $('#url').addClass("is-valid").removeClass("is-invalid")
    } else {
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
        return "false"
    }
}

// INFO METHODS

function showInfo(url) {
    $(".spinner-border").css("display", "inherit");
    selectedURL = url
    youtubedl.exec(selectedURL, ['-J','--skip-download'], {}, function(err, output) {
        if (err) showError(err)
        let video = JSON.parse(output)
        console.log(video)
        let date = new Date(video.duration * 1000)
        let duration = parseInt(date / 86400000) + "d " + date.toISOString().substr(11, 8)
        $(".thumbnail").attr("src", video.thumbnail)
        $(".thumbnail-settings").attr("src", video.thumbnail)
        $(".title").html("<strong>Title:</strong> " + video.title)
        $(".channel").html("<strong>Channel:</strong> " + video.uploader)
        $(".duration").html("<strong>Duration:</strong> " + duration.replace(/(0d\s00:)|(0d\s)/g,""))
        $(".spinner-border").css("display", "none")
        $('#step-one-btn').prop("disabled", false)
        video.formats.forEach(function(format) {
            if(format.fps !== null) {
                let alreadyIncludes
                availableVideoFormats.forEach(function(savedFormat) {
                    if(savedFormat.format_note === format.format_note) alreadyIncludes = true
                })
                if(!alreadyIncludes) {
                    availableVideoFormats.push(format)
                }
            } else if(format.ext === "m4a") {
                audioFormat = format
            }
        })
    })
}

function showPlaylistInfo(url) {
    $(".spinner-border").css("display", "inherit");
    selectedURL = url
    youtubedl.exec(selectedURL, ['-J','--skip-download'], {}, function(err, output) {
        if (err) showError(err)
        let info = JSON.parse(output)
        console.log(info)
        $(".thumbnail").attr("src", info.entries[0].thumbnail)
        $(".thumbnail-settings").attr("src", info.entries[0].thumbnail)
        $(".title").html("<strong>Playlist name:</strong> " + info.title)
        $(".channel").html("<strong>Channel:</strong> " + info.uploader)
        $(".duration").html("<strong>Playlist size:</strong> " + info.entries.length + " videos")
        $(".spinner-border").css("display", "none")
        $('#step-one-btn').prop("disabled", false)
        info.entries.forEach(function(video) {
            playlistVideos.push(video)
            video.formats.forEach(function(format) {
                if(format.format_note !== "tiny") {
                    let alreadyIncludes
                    availableVideoFormats.forEach(function(savedFormat) {
                        if(savedFormat.format_note === format.format_note) alreadyIncludes = true
                    })
                    if(!alreadyIncludes) {
                        availableVideoFormats.push(format)
                    }
                }
            })
        })
    })
}

// DOWNLOAD METHODS

function downloadAudio(quality) {
    console.log(quality)
    let realQuality = 0
    if(quality === "worst") {
        realQuality = '9'
    }
    const options = [
        '--extract-audio', '--audio-quality', realQuality,
        '--audio-format', 'mp3',
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        '--embed-thumbnail',
        '-o', downloadPath.replace(/\\/g, "/") + '/' + '%(title)s.%(ext)s'
    ]
    console.log(options)
    youtubedl.exec(selectedURL, options, {}, function(err, output) {
        if (err) showError(err)
        downloadFinished()
        console.log(output)
    })
}

function downloadVideo(format_id) {
    const options = [
        '-f', format_id + "+bestaudio[ext=m4a]/best",
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        '--merge-output-format', 'mp4',
        '-o', downloadPath.replace(/\\/g, "/") + '/' + '%(title)s-(%(height)sp%(fps)s).%(ext)s'
    ]
    if($('#subtitles').prop('checked')) {
        options.push("--all-subs")
        options.push("--embed-subs")
        options.push("--convert-subs")
        options.push("srt")
    }
    console.log(options)
    youtubedl.exec(selectedURL, options, {}, function(err, output) {
        if (err) showError(err)
        downloadFinished()
        console.log(output)
    })
}

function downloadPlaylist(quality) {
    console.log("downloading playlist")
    let amountToDownload = playlistVideos.length
    $('.completion').html("Video 0 of " + amountToDownload + " downloaded")
    let videosDownloaded = 0
    let videosQueued = 0
    let options
    let downloader = new Promise((resolve, reject) => {
    playlistVideos.forEach(function(video) {
        if($('input[name=type-select]:checked').val() === "audio") {
            let realQuality = 0
            if(quality === "worst") {
                realQuality = '9'
            }
            options = [
                '--extract-audio', '--audio-quality', realQuality,
                '--audio-format', 'mp3',
                '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
                '--embed-thumbnail',
                '-o', downloadPath.replace(/\\/g, "/") + '/' + '%(title)s.%(ext)s'
            ]
        } else {
            options = [
                '-f', playlistFormatIDs[videosQueued] + "+bestaudio[ext=m4a]/best+bestaudio[ext=m4a]",
                '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
                '--merge-output-format', 'mp4',
                '-o', downloadPath.replace(/\\/g, "/") + '/' + '%(title)s-(%(height)sp%(fps)s).%(ext)s'
            ]
        }
        if($('#subtitles').prop('checked')) {
            options.push("--all-subs")
            options.push("--embed-subs")
            options.push("--convert-subs")
            options.push("srt")
        }
        videosQueued++
        youtubedl.exec(video.webpage_url, options, {}, function(err, output) {
            if (err) showError(err)
            ++videosDownloaded
            let percentage = ((videosDownloaded / amountToDownload) * 100) + "%"
            $('.progress-bar').css("width", percentage).attr("aria-valuenow", percentage.slice(0,-1))
            $('.completion').html("Video " + videosDownloaded + " of " + amountToDownload + " downloaded")
            if(videosDownloaded === amountToDownload) {
                resolve()
            }
            console.log(videosDownloaded)
        })
    })
    })
    downloader.then(() => {
        downloadFinished()
        $('.completion').html("All videos downloaded")
    })
}

function download() {
    let quality = $('#quality').val()
    timings = setTimeout(showWarning, 90000)
    stepper.next()
    if(mediaMode === "playlist") {
        downloadPlaylist(quality)
        $('.progress').css("display", "initial")
    } else {
        if ($('input[name=type-select]:checked').val() === "video") {
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


// RESET METHODS

function resetSteps() {
    selectedURL = ""
    availableVideoFormats = []
    playlistFormatIDs = []
    playlistVideos = []
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
    $('#step-one-btn').prop("disabled", true)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#quality').empty().append(new Option("Select quality", "quality")).prop("disabled", true).val("quality")
    $("#download-btn").prop("disabled", true)
    $("#directoryInput").prop("disabled", true)
    $('.progress-bar').css("width", "0%").attr("aria-valuenow", "0")
    $('.progress').css("display", "none")
    stepper.reset()
}

function resetBack() {
    stepper.reset()
    $('#video').prop("checked", false)
    $('#audio').prop("checked", false)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#quality').empty().append(new Option("Select quality", "quality")).prop("disabled", true).val("quality")
    $("#download-btn").prop("disabled", true)
    $("#directoryInput").prop("disabled", true)
    $(".size").html("<strong>Download size:</strong> --")
}

function setType(type) {
    $("#download-btn").prop("disabled", false)
    $("#directoryInput").prop("disabled", false)
    if(mediaMode === "playlist") {
        if(type === "video") {
            $('#quality').empty()
            availableVideoFormats.forEach(function (format) {
                $('#quality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
                $('#subtitles').prop("disabled", false)
            })
            $('#quality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
            $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
        } else if(type === "audio") {
            $('#quality').empty().append(new Option("Best", "best")).append(new Option("Worst", "worst")).prop("disabled", false).val("best")
            $('.size').html('<b>Download size: </b>' + '~' + getTotalSize())
        }
    } else {
        if (type === "audio") {
            mediaMode = "audio"
            $('#quality').empty().append(new Option("Best", "best")).append(new Option("Worst", "worst")).prop("disabled", false).val("best")
            $('.size').html('<b>Download size: </b>' + '~' + getTotalSize())
        } else if (type === "video") {
            mediaMode = "video"
            $('#quality').empty()
            availableVideoFormats.forEach(function (format) {
                $('#quality').append(new Option(format.format_note, format.format_id)).prop("disabled", false)
                $('#subtitles').prop("disabled", false)
            })
            $('#quality').val(availableVideoFormats[availableVideoFormats.length - 1].format_id)
            $('.size').html('<b>Download size: </b>' + getTotalSize(availableVideoFormats[availableVideoFormats.length - 1].format_note))
        }
    }
}

function getTotalSize(videoQuality) {
    if(mediaMode === "playlist") {
        if($('input[name=type-select]:checked').val() === "video") {
            let sum = 0
            playlistVideos.forEach(function (video) {
                let filteredFormats = []
                video.formats.forEach(function (format) {
                    let includes
                    if (format.ext === "m4a") {
                        sum += format.filesize
                        console.log("audio size direct m4a match " + format.filesize)
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
                        console.log("video size direct match " + filteredFormat.filesize)
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
                                    console.log("video size indirect match " + format.filesize)
                                }
                            })
                        }
                    })
                }
                console.log(filteredFormats)
            })
            return (sum / 1.049e+6).toFixed(1) + " MB"
        } else {
            let sum = 0
            playlistVideos.forEach(function (video) {
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
        if (videoQuality != null) {
            for (var i = 0; i < availableVideoFormats.length; i++) {
                if (availableVideoFormats[i].format_note === videoQuality) {
                    sum += availableVideoFormats[i].filesize
                    break
                }
            }
        }
        return (sum / 1.049e+6).toFixed(1) + " MB"
    }
}

$(document).ready(function () {
    $("#quality").on('change', function () {
        if (mediaMode === "audio") return
        let selected = document.getElementById("quality").options[document.getElementById("quality").selectedIndex].text
        availableVideoFormats.forEach(function(format) {
            if(format.format_note === selected) {
                $('.size').html('<b>Download size: </b>' + getTotalSize(format.format_note))
            }
        })

    })
})
