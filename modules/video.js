'use strict'
let audioOutputName
let videoOutputName
let videoFPS
let videoTitle
let username
let password
let cookies
let cookiePath
let downloadPath
let credentialsFilled = false

function getMetadata(url) {
    $(".spinner-border").css("display", "inherit");
    ipcRenderer.invoke('updateProgressBar', 'indeterminate')
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
    callYTDL(url, options, {}, true, async function(err, output) {
        if(output == null) {
            $('.invalid-feedback').html("This video does not exist or is blocked in your country.")
            $('#url').addClass("is-invalid").removeClass("is-valid")
            $(".spinner-border").css("display", "none")
            $('.authenticated').css('display','none')
            return
        }
        if(output === "") {
            console.log('possible private video')
            if(cookies || credentialsFilled) {
                $('.invalid-feedback').html("This cookies.txt file does not appear to be working, add a working <a class='credentials' data-toggle='modal' data-target='#cookiesModal'>cookies.txt</a> file to download private video&#39;s.")
            } else {
                //$('.invalid-feedback').html("This video is private, <a class='credentials' data-toggle='modal' data-target='#credentialsModal'>add credentials</a> or add a <a class='credentials' data-toggle='modal' data-target='#cookiesModal'>cookies.txt</a> file to download private video&#39;s.")
                $('.invalid-feedback').html("This video is private, add a <a class='credentials' data-toggle='modal' data-target='#cookiesModal'>cookies.txt</a> file to download private video&#39;s.")
            }
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
        $(".title").html("<strong>Title:</strong> " + video.title).css("display", "block")
        $(".channel").html("<strong>Channel:</strong> " + video.uploader).css("display", "block")
        $(".duration").html("<strong>Duration:</strong> " + duration.replace(/(0d\s00:)|(0d\s)/g,""))
        $(".spinner-border").css("display", "none")
        if(credentialsFilled || cookies) {
            if(await isPublicVideo(url)) {
                $('.authenticated').css('display','none')
            } else {
                $('.authenticated').css('display','initial')
                $('#url').addClass("is-valid").removeClass("is-invalid")
                $('.invalid-feedback').css('display','none')
            }
        }
        $('#step-one-btn').prop("disabled", false)
        audioOutputName = video.title + ".mp3"
        videoFPS = video.fps
        videoTitle = video.title
        ipcRenderer.invoke('updateProgressBar', 'hide')
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

async function isPublicVideo(url) {
    let options = [
        '-J',
        '--skip-download'
    ]
    const call = new Promise((resolve, reject) => {
        callYTDL(url, options, {}, true, function(err, output) {
            if(output === "") {
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
    return await call
}

function downloadAudio(quality) {
    ipcRenderer.invoke('updateProgressBar', 'indeterminate')
    if(process.platform === "win32") ipcRenderer.invoke('setOverlayIcon', {mode: "downloading"})
    console.log("downloading audio: " + selectedURL)
    let realQuality = 0
    if(quality === "worst") {
        realQuality = '9'
    }
    const options = [
        '--extract-audio', '--audio-quality', realQuality,
        '--audio-format', 'mp3', '--no-mtime',
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        '--embed-thumbnail',
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

function downloadVideo(format_id, audioQuality) {
    let format = $("#videoquality option:selected" ).text()
    if(format.substr(format.indexOf('p') + 1) !== "") videoFPS = format.substr(format.indexOf('p') + 1)
    if(process.platform === "win32") ipcRenderer.invoke('setOverlayIcon', {mode: "downloading"})
    videoOutputName = videoTitle + "-(" + format.substr(0, format.indexOf("p")) + "p" + videoFPS + ").mp4"
    console.log("downloading video: " + selectedURL)
    const options = [
        '-f', format_id + "+" + audioQuality + "audio[ext=m4a]/best",
        '--ffmpeg-location', ffmpegLoc, '--hls-prefer-ffmpeg',
        '--merge-output-format', 'mp4', '--no-mtime',
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
