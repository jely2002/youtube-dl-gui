'use strict'
let audioOutputName
let videoOutputName
let videoFPS
let videoTitle
let username
let password
let cookies
let cookiePath = remote.app.getPath('downloads')
let credentialsFilled = false
function showInfo(url) {
    $(".spinner-border").css("display", "inherit");
    remote.getCurrentWindow().setProgressBar(2, {mode: "indeterminate"})
    selectedURL = url
    let options = [
        '-J',
        '--skip-download'
        ]
    if(credentialsFilled) {
        options.push('-u')
        options.push(username)
        options.push('-p')
        options.push(password)
    }
    if(cookies) {
        options.push('--cookies')
        options.push(cookiePath)
    }
    callYTDL(selectedURL, options, {}, true, function(err, output) {
        if(output == null) {
            $('.invalid-feedback').html("This video does not exist or is blocked in your country.")
            $('#url').addClass("is-invalid").removeClass("is-valid")
            $(".spinner-border").css("display", "none")
            $('.authenticated').css('display','none')
            return
        }
        if(output === "") {
            console.log('possible private video')
            //$('.invalid-feedback').html("This video is private, <a class='credentials' data-toggle='modal' data-target='#credentialsModal'>add credentials</a> or add a <a class='credentials' data-toggle='modal' data-target='#cookiesModal'>cookies.txt</a> file to download private video&#39;s.")
            $('.invalid-feedback').html("This video is private, add a <a class='credentials' data-toggle='modal' data-target='#cookiesModal'>cookies.txt</a> file to download private video&#39;s.")
            $('#url').addClass("is-invalid").removeClass("is-valid")
            $(".spinner-border").css("display", "none")
            $('.authenticated').css('display','none')
            return
        }
        if (err) showError(err)
        let video = JSON.parse(output)
        let date = new Date(video.duration * 1000)
        let duration = parseInt(date / 86400000) + "d " + date.toISOString().substr(11, 8)
        $(".thumbnail").attr("src", video.thumbnail)
        $(".thumbnail-settings").attr("src", video.thumbnail)
        $(".title").html("<strong>Title:</strong> " + video.title)
        $(".channel").html("<strong>Channel:</strong> " + video.uploader)
        $(".duration").html("<strong>Duration:</strong> " + duration.replace(/(0d\s00:)|(0d\s)/g,""))
        $(".spinner-border").css("display", "none")
        if(credentialsFilled || cookies) {
            $('.authenticated').css('display','initial')
            $('#url').addClass("is-valid").removeClass("is-invalid")
            $('.invalid-feedback').css('display','none')
        }
        $('#step-one-btn').prop("disabled", false)
        audioOutputName = video.title + ".mp3"
        videoFPS = video.fps
        videoTitle = video.title
        remote.getCurrentWindow().setProgressBar(-1, {mode: "none"})
        video.formats.forEach(function(format) {
            if(format.format_note === "DASH video") {
                let alreadyIncludes
                availableVideoFormats.forEach(function (savedFormat) {
                    if (savedFormat.height === format.height && savedFormat.fps === format.fps) alreadyIncludes = true
                })
                if (!alreadyIncludes) {
                    availableVideoFormats.push(format)
                }
            } else {
                if (format.fps !== null) {
                    let alreadyIncludes
                    availableVideoFormats.forEach(function (savedFormat) {
                        if (savedFormat.format_note === format.format_note) alreadyIncludes = true
                    })
                    if (!alreadyIncludes) {
                        availableVideoFormats.push(format)
                    }
                } else if (format.ext === "m4a") {
                    audioFormat = format
                }
            }
        })
    })
}

function downloadAudio(quality) {
    remote.getCurrentWindow().setProgressBar(2, {mode: "indeterminate"})
    if(process.platform === "win32") ipcRenderer.send('request-mainprocess-action', {mode: "downloading"})
    console.log("downloading audio: " + selectedURL)
    let realQuality = 0
    if(quality === "worst") {
        realQuality = '9'
    }
    const options = [
        '--extract-audio', '--audio-quality', realQuality,
        '--audio-format', 'mp3',
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        /*'--embed-thumbnail',*/
        '-o', downloadPath.replace(/\\/g, "/") + '/' + '%(title)s.%(ext)s'
    ]
    if(credentialsFilled) {
        options.push('-u')
        options.push(username)
        options.push('-p')
        options.push(password)
    }
    if(cookies) {
        options.push('--cookies')
        options.push(cookiePath)
    }
    callYTDL(selectedURL, options, {}, false, function(err, output) {
        if (err) showError(err)
        downloadFinished()
    })
}

function downloadVideo(format_id) {
    let format = $("#quality option:selected" ).text()
    if(format.substr(format.indexOf('p') + 1) !== "") videoFPS = format.substr(format.indexOf('p') + 1)
    remote.getCurrentWindow().setProgressBar(2, {mode: "indeterminate"})
    if(process.platform === "win32") ipcRenderer.send('request-mainprocess-action', {mode: "downloading"})
    videoOutputName = videoTitle + "-(" + format.substr(0, format.indexOf("p")) + "p" + videoFPS + ").mp4"
    console.log("downloading video: " + selectedURL)
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
    if(credentialsFilled) {
        options.push('-u')
        options.push(username)
        options.push('-p')
        options.push(password)
    }
    if(cookies) {
        options.push('--cookies')
        options.push(cookiePath)
    }
    callYTDL(selectedURL, options, {}, false, function(err, output) {
        if (err) showError(err)
        downloadFinished()
    })
}
