'use strict'
const youtubedl = require('youtube-dl')
const {remote} = require('electron')

let selectedURL
let availableFormats = []
let ffmpegLoc
let timings

if(process.platform === "darwin") {
    youtubedl.setYtdlBinary("Contents/Resources/youtube-dl-ml")
    ffmpegLoc = "Contents/Resources/ffmpeg-ml"
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
        output.forEach(function(entry) {
            if(!(entry.includes('mp4') || entry.includes('webm'))) return
            if(entry.includes('4320p')) addFormat("4320p", entry)
            if(entry.includes('2160p')) addFormat("2160p", entry)
            if(entry.includes('1440p')) addFormat("1440p", entry)
            if(entry.includes('1080p')) addFormat("1080p", entry)
            if(entry.includes('720p')) addFormat("720p", entry)
            if(entry.includes('480p')) addFormat("480p", entry)
            if(entry.includes('360p')) addFormat("360p", entry)
            if(entry.includes('240p')) addFormat("240p", entry)
            if(entry.includes('144p')) addFormat("144p", entry)
            })
    })
}

function downloadAudio(quality) {
    const options = [
        '-f', quality + 'audio[ext=m4a]',
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        '-o', remote.app.getPath('music').replace(/\\/g, "/") + '/' + '%(title)s.%(ext)s'
    ]
    youtubedl.exec(selectedURL, options, {}, function(err, output) {
        if (err) showError(err)
        downloadFinished()
        console.log(output)
    })
}

function downloadVideo(quality) {
    let downloadSubs = $('#subtitles').prop('checked')
    let fps = quality.substr(-2)
    let qualityOption
    let height
    if(fps === "60" || fps === "50") {
        height = quality.slice(0,-3);
        qualityOption = 'bestvideo[height<='+ height + '][fps=' + fps + ']+bestaudio[ext=m4a]/best[height<=' + height + '][fps=' + fps + ']'
    } else {
        height = quality.slice(0,-1);
        qualityOption = 'bestvideo[height<='+ height + '][fps<50]+bestaudio[ext=m4a]/best[height<=' + height + '][fps<50]'
    }
    const options = [
        '-f', qualityOption,
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        '--merge-output-format', 'mp4',
        '-o', remote.app.getPath('videos').replace(/\\/g, "/") + '/' + '%(title)s.%(ext)s'
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
    timings = setTimeout(showWarning, 60000)
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

function addFormat(quality, entry) {
    if(entry.includes(quality + "60")) {
        if(!availableFormats.includes(quality + "60")) availableFormats.push(quality + "60")
    } else if(entry.includes(quality + "50")) {
        if(!availableFormats.includes(quality + "50")) availableFormats.push(quality + "50")
    } else {
        if(!availableFormats.includes(quality)) availableFormats.push(quality)
    }
}

function resetSteps() {
    selectedURL = ""
    availableFormats = []
    $('#url').removeClass("is-valid").removeClass("is-invalid")
    $(".thumbnail").attr("src", "https://via.placeholder.com/640x360?text=%20")
    $(".title").html("<strong>Title:</strong> --")
    $(".channel").html("<strong>Channel:</strong> --")
    $(".duration").html("<strong>Duration:</strong> --")
    $('.main-input').trigger('reset')
    $('.circle-loader').toggleClass('load-complete')
    $('.checkmark').toggle()
    $('#reset-btn').html("Downloading...").prop("disabled", true)
    $('#step-one-btn').prop("disabled", true)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#quality').empty().append(new Option("Select quality", "quality")).prop("disabled", true).val("quality")
    $("#download-btn").prop("disabled", true)
    stepper.reset()
}

function resetBack() {
    stepper.reset()
    $('#video').prop("checked", false)
    $('#audio').prop("checked", false)
    $('#subtitles').prop("disabled", true).prop("checked", false)
    $('#quality').empty().append(new Option("Select quality", "quality")).prop("disabled", true).val("quality")
    $("#download-btn").prop("disabled", true)
}

function showWarning() {
    $('#warning').toast('show')
}

function showError(err) {
    $('.error-body').html(err.toString())
    $('#error').toast('show')
}
