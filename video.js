function showInfo(url) {
    $(".spinner-border").css("display", "inherit");
    remote.getCurrentWindow().setProgressBar(2, {mode: "indeterminate"})
    selectedURL = url
    callYTDL(selectedURL, ['-J','--skip-download'], {}, function(err, output) {
        if(output == null) {
            $('.invalid-feedback').html("This video does not exist, is private or is blocked")
            $('#url').addClass("is-invalid").removeClass("is-valid")
            $(".spinner-border").css("display", "none")
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
        $('#step-one-btn').prop("disabled", false)
        remote.getCurrentWindow().setProgressBar(-1, {mode: "none"})
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

function downloadAudio(quality) {
    remote.getCurrentWindow().setProgressBar(2, {mode: "indeterminate"})
    console.log("downloading audio: " + selectedURL)
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
    callYTDL(selectedURL, options, {}, function(err, output) {
        if (err) showError(err)
        downloadFinished()
    })
}

function downloadVideo(format_id) {
    remote.getCurrentWindow().setProgressBar(2, {mode: "indeterminate"})
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
    callYTDL(selectedURL, options, {}, function(err, output) {
        if (err) showError(err)
        downloadFinished()
    })
}
