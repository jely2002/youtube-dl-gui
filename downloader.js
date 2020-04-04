'use strict'
const youtubedl = require('youtube-dl')
const {remote} = require('electron')

let selectedURL
let availableFormats = []
let availableFormatCodes = []
let formatSizes = []
let audioSize;
let ffmpegLoc
let timings

if(process.platform === "darwin") {
    let appPath = remote.app.getAppPath().slice(0, -8)
    youtubedl.setYtdlBinary(appPath + "youtube-dl-darwin")
    ffmpegLoc = appPath + "ffmpeg-darwin"
} else {
    youtubedl.setYtdlBinary("resources/youtube-dl.exe")
    ffmpegLoc = "resources/ffmpeg.exe"
}


function settings() {
    stepper.next()
    selectedURL = $("#url").val()
}

function url_entered() {
    let url = $("#url").val()
    if(validate(url)) {
        availableFormats = []
        formatSizes = []
        availableFormatCodes = []
        audioSize = []
        showInfo(url)
        $('#url').addClass("is-valid").removeClass("is-invalid")
    } else {
        $('#url').addClass("is-invalid").removeClass("is-valid")
        $('#step-one-btn').prop("disabled", true)
    }
}

function validate(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi
    return (regex.test(url))
}

function showInfo(url) {
    $(".spinner-border").css("display", "inherit");
    youtubedl.getInfo(url, function(err, info) {
        if (err) showError(err)
        $(".thumbnail").attr("src", info.thumbnail)
        $(".thumbnail-settings").attr("src", info.thumbnail)
        $(".title").html("<strong>Title:</strong> " + info.title)
        $(".channel").html("<strong>Channel:</strong> " + info.uploader)
        $(".duration").html("<strong>Duration:</strong> " + info.duration)
        $(".spinner-border").css("display", "none")
        $('#step-one-btn').prop("disabled", false)
    });
    selectedURL = url
    youtubedl.exec(selectedURL, ['-F','--skip-download'], {}, function(err, output) {
        if (err) showError(err)
        output.splice(0,3)
        console.log(output)
        let audio
        output.forEach(function(entry) {
            if(entry.includes("audio only") && entry.includes("m4a")) audio = entry
            if(!(entry.includes('mp4') || entry.includes('webm'))) return
            if(entry.includes('4320p')) addFormat("4320p", entry, audio)
            if(entry.includes('2160p')) addFormat("2160p", entry, audio)
            if(entry.includes('1440p')) addFormat("1440p", entry, audio)
            if(entry.includes('1080p')) addFormat("1080p", entry, audio)
            if(entry.includes('720p')) addFormat("720p", entry, audio)
            if(entry.includes('480p')) addFormat("480p", entry, audio)
            if(entry.includes('360p')) addFormat("360p", entry, audio)
            if(entry.includes('240p')) addFormat("240p", entry, audio)
            if(entry.includes('144p')) addFormat("144p", entry, audio)
            })
    })
}

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

function downloadVideo(quality) {
    let downloadSubs = $('#subtitles').prop('checked')
    let qualityOption = quality + "+bestaudio[ext=m4a]/best"
    const options = [
        '-f', qualityOption,
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        '--merge-output-format', 'mp4',
        '-o', downloadPath.replace(/\\/g, "/") + '/' + '%(title)s-(%(height)sp%(fps)s).%(ext)s'
    ]
    if(downloadSubs) {
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

function download() {
    let quality = $('#quality').val()
    timings = setTimeout(showWarning, 90000)
    stepper.next()
    if($('input[name=type-select]:checked').val() === "video") {
        downloadVideo(quality)
    } else {
        downloadAudio(quality)
    }
}

function downloadFinished() {
    clearTimeout(timings)
    $('.circle-loader').toggleClass('load-complete')
    $('.checkmark').toggle()
    $('#reset-btn').html("Download another video").prop("disabled", false)
}

function addSize(entry, audio) {
    let vidSizeUnformat = entry.split(' ').pop()
    let vidUnit = vidSizeUnformat.slice(-3)
    let vidSize = parseFloat(vidSizeUnformat.slice(0, -3))
    let audSizeUnformat = audio.split(' ').pop()
    let audUnit = audSizeUnformat.slice(-3)
    let audSize = parseFloat(audSizeUnformat.slice(0, -3))
    if(vidUnit === audUnit) {
        let mib = audSize + vidSize
        formatSizes.push(mib.toFixed(1) + "MB")
    } else if(audUnit === "MiB") {
        let mib = audSize + (vidSize/1024)
        formatSizes.push(mib.toFixed(1) + "MB")
    } else if(audUnit === "KiB") {
        let mib = (audSize/1024 + vidSize)
        formatSizes.push(mib.toFixed(1) + "MB")
    }
    audioSize = "~" + audSize.toFixed(1) + "MB"
}

function addFormat(quality, entry, audio) {
    if(entry.includes(quality + "60")) {
        if(!availableFormats.includes(quality + "60")) {
            availableFormats.push(quality + "60")
            availableFormatCodes.push(entry.slice(0,3))
            addSize(entry, audio)
        }
    } else if(entry.includes(quality + "50")) {
        if(!availableFormats.includes(quality + "50")) {
            availableFormats.push(quality + "50")
            availableFormatCodes.push(entry.slice(0,3))
            addSize(entry, audio)
        }
    } else {
        if(!availableFormats.includes(quality)) {
            availableFormats.push(quality)
            availableFormatCodes.push(entry.slice(0,3))
            addSize(entry, audio)
        }
    }

}

function resetSteps() {
    selectedURL = ""
    availableFormats = []
    formatSizes = []
    availableFormatCodes = []
    audioSize = []
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

function showWarning() {
    $('#warning').toast('show')
}

function showError(err) {
    $('.error-body').html(err.toString())
    $('#error').toast('show')
}
