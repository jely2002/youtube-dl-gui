function showInfo(url) {
    $(".spinner-border").css("display", "inherit");
    selectedURL = url
    youtubedl.exec(selectedURL, ['-J','--skip-download'], {}, function(err, output) {
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
    youtubedl.exec(selectedURL, options, {}, function(err, output) {
        if (err) showError(err)
        downloadFinished()
    })
}

function downloadVideo(format_id) {
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
    youtubedl.exec(selectedURL, options, {}, function(err, output) {
        if (err) showError(err)
        downloadFinished()
    })
}
