const youtubedl = require('youtube-dl')
const {remote} = require('electron')

let selectedURL
let availableFormats = []

youtubedl.setYtdlBinary("resources/app.asar.unpacked/node_modules/youtube-dl/bin/youtube-dl.exe")

function settings() {
    stepper.next()
    selectedURL = $("#url").val()
}

function url_entered() {
    let url = $("#url").val()
    if(validate(url)) {
        showInfo(url)
        $('#url').addClass("is-valid").removeClass("is-invalid")
    } else {
        $('#url').addClass("is-invalid").removeClass("is-valid")
    }
}

function validate(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi
    return (regex.test(url))
}

function showInfo(url) {
    $(".spinner-border").css("display", "inherit");
    youtubedl.getInfo(url, function(err, info) {
        if (err) throw err
        $(".thumbnail").attr("src", info.thumbnail)
        $(".title").html("<strong>Title:</strong> " + info.title)
        $(".channel").html("<strong>Channel:</strong> " + info.uploader)
        $(".duration").html("<strong>Duration:</strong> " + info.duration)
        $(".spinner-border").css("display", "none")
        $('#step-one-btn').prop("disabled", false)
    });
    selectedURL = url
    youtubedl.exec(selectedURL, ['-F','--skip-download'], {}, function(err, output) {
        if (err) throw err
        output.splice(0,3)
        console.log(output)
        output.forEach(function(entry) {
            if(!(entry.includes('mp4'))) return
            if(entry.includes('4320p') && !availableFormats.includes('4320p')) availableFormats.push('4320p')
            if(entry.includes('2160p') && !availableFormats.includes('2160p')) availableFormats.push('2160p')
            if(entry.includes('1440p') && !availableFormats.includes('1440p')) availableFormats.push('1440p')
            if(entry.includes('1080p') && !availableFormats.includes('1080p')) availableFormats.push('1080p')
            if(entry.includes('720p') && !availableFormats.includes('720p')) availableFormats.push('720p')
            if(entry.includes('480p') && !availableFormats.includes('480p')) availableFormats.push('480p')
            if(entry.includes('360p') && !availableFormats.includes('360p')) availableFormats.push('360p')
            if(entry.includes('240p') && !availableFormats.includes('240p')) availableFormats.push('240p')
            if(entry.includes('144p') && !availableFormats.includes('144p')) availableFormats.push('144p')
            })
    })
}

function downloadAudio(quality) {
    const options = [
        '-f', quality + 'audio[ext=m4a]',
        '--ffmpeg-location', 'bin/ffmpeg.exe', '--hls-prefer-ffmpeg',
        '-o', remote.app.getPath('music').replace(/\\/g, "/") + '/' + '%(title)s.%(ext)s'
    ]

    youtubedl.exec(selectedURL, options, {}, function(err, output) {
        if (err) throw err
        downloadFinished()
        console.log(output)
    })
}

function downloadVideo(quality) {
    const options = [
        '-f', 'bestvideo[height<='+ quality + ',ext=mp4]+bestaudio[ext=m4a]/best[height<=' + quality + ']',
        '--ffmpeg-location', 'ffmpeg.exe', '--hls-prefer-ffmpeg',
        '--merge-output-format', 'mp4',
        '-o', remote.app.getPath('videos').replace(/\\/g, "/") + '/' + '%(title)s.%(ext)s'
    ]

    youtubedl.exec(selectedURL, options, {}, function(err, output) {
        if (err) throw err
        downloadFinished()
        console.log(output)
    })
}

function download() {
    let quality = $('#quality').val()
    stepper.next()
    if($('input[name=type-select]:checked').val() === "video") {
        downloadVideo(quality)
    } else {
        downloadAudio(quality)
    }
}

function downloadFinished() {
    $('.circle-loader').toggleClass('load-complete')
    $('.checkmark').toggle()
    $('#reset-btn').html("Download another video").prop("disabled", false)
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
    $('#quality').empty().append(new Option("Select quality", "quality")).prop("disabled", true).val("quality")
    stepper.reset()
}
