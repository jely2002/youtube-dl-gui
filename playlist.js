'use strict'
let videoURLS = []
let filteredVideoURLS = []
let metaVideos = []
function showPlaylistInfo(url) {
    $(".spinner-border").css("display", "inherit");
    selectedURL = url
    $('.completion.metadata').html("Fetching playlist metadata...")
    $(".progress.metadata").css("display", "inherit");

    let amountToDownload = 0
    let metadataDownloaded = 0
    function getVideoMetadata(item, cb) {
        callYTDL(item, ['-J', '--skip-download'], {}, function (err, output) {
            if(output == null) {
                ++metadataDownloaded
                metaVideos.push({removed: "yes", playlist_index: 0, webpage_url: item})
                let percentage = ((metadataDownloaded / amountToDownload) * 100) + "%"
                $('.progress-bar.metadata').css("width", percentage).attr("aria-valuenow", percentage.slice(0, -1))
                $('.completion.metadata').html("Fetching video metadata (" + metadataDownloaded + " of " + amountToDownload + ")")
                console.log(output)
                cb()
                return
            }
            if (err) showError(err)
            let video = JSON.parse(output)
            metaVideos.push(video)
            ++metadataDownloaded
            let percentage = ((metadataDownloaded / amountToDownload) * 100) + "%"
            $('.progress-bar.metadata').css("width", percentage).attr("aria-valuenow", percentage.slice(0, -1))
            $('.completion.metadata').html("Fetching video metadata (" + metadataDownloaded + " of " + amountToDownload + ")")
            remote.getCurrentWindow().setProgressBar(metadataDownloaded / amountToDownload)
            cb()
        })
    }

    let playlistmetadata = new Promise((resolve, reject) => {
        callYTDL(selectedURL, ['-J', '--flat-playlist'], {}, function (err, output) {
            if(output == null) {
                if(err) console.log(err)
                $('.invalid-feedback').html("This playlist does not exist, is private or is blocked")
                $('#url').addClass("is-invalid").removeClass("is-valid")
                $(".spinner-border").css("display", "none")
                $(".progress.metadata").css("display", "none");
                return
            }
            if (err) showError(err)
            let metadata = JSON.parse(output)
            amountToDownload = metadata.entries.length
            $(".title").html("<strong>Playlist name:</strong> " + metadata.title)
            $(".channel").html("<strong>Channel:</strong> " + metadata.uploader)
            $(".duration").html("<strong>Playlist size:</strong> " + amountToDownload + " videos")
            $('#max').val(amountToDownload)
            metadata.entries.forEach(function (entry) {
                videoURLS.push("https://www.youtube.com/watch?v=" + entry.id)
                filteredVideoURLS.push("https://www.youtube.com/watch?v=" + entry.id)
            })
            $('.completion.metadata').html("Fetching video metadata (" + metadataDownloaded + " of " + amountToDownload + ")")
            console.log(videoURLS)
            resolve()
        })
    })

    playlistmetadata.then(() => {
        let firstSideResolved = false
        let secondSideResolved = false
        let thirdSideResolved = false
        let fourthSideResolved = false

        if(cacheAvailable(selectedURL)) {
            removeVideosFromCache(selectedURL, function () {
                if (isCacheUpToDate(selectedURL)) {
                    $('.completion.metadata').html("Up-to-date cache found!")
                    playlistVideos = getCachedPlaylist(selectedURL)
                    firstSideResolved = true
                    secondSideResolved = true
                    thirdSideResolved = true
                    fourthSideResolved = true
                    $('.progress-bar.metadata').css("width", "100%").attr("aria-valuenow", "100")
                    done()
                } else {
                    filteredVideoURLS = getCacheDifference(selectedURL)
                    amountToDownload = filteredVideoURLS.length
                    $('.completion.metadata').html("Updating metadata cache (" + metadataDownloaded + " of " + amountToDownload + ")")
                    continueDownload()
                }
            })
        } else {
            continueDownload()
        }

        function done() {
            if (!(firstSideResolved && secondSideResolved && thirdSideResolved && fourthSideResolved)) return
            addCachedPlaylist(selectedURL, metaVideos)
            console.log(playlistVideos)
            videoURLS.forEach(function (url) {
                playlistVideos.forEach(function (video) {
                    if (video.webpage_url === url || (video.removed === "yes" && video.webpage_url === url)) video.playlist_index = videoURLS.indexOf(url) + 1
                })
            })
            playlistVideos.sort(function (a, b) {
                return a.playlist_index - b.playlist_index;
            });
            $('.completion.metadata').html("Fetched all metadata!")
            remote.getCurrentWindow().setProgressBar(-1, {mode: "none"})
            $(".thumbnail").attr("src", playlistVideos[0].thumbnail)
            $(".thumbnail-settings").attr("src", playlistVideos[0].thumbnail)
            $(".spinner-border").css("display", "none")
            $('#step-one-btn').prop("disabled", false)
            $('.video-range').css("display", "initial")
            playlistVideos.forEach(function (video) {
                if (video.removed === "yes") return
                video.formats.forEach(function (format) {
                    if (format.format_note === "DASH audio") return
                    if (format.format_note === "DASH video") return
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
        }

        function continueDownload() {
            let halfSlice1 = filteredVideoURLS.slice(0)
            let halfSlice2 = halfSlice1.splice(0, Math.floor(halfSlice1.length / 2))
            let quarterSlice1 = halfSlice1.splice(0, Math.floor(halfSlice1.length / 2))
            let quarterSlice2 = halfSlice2.splice(0, Math.floor(halfSlice2.length / 2))

            let videometadata1 = halfSlice1.reduce((promiseChain, item) => {
                return promiseChain.then(() => new Promise((resolve) => {
                    getVideoMetadata(item, resolve)
                }))
            }, Promise.resolve())

            let videometadata2 = halfSlice2.reduce((promiseChain, item) => {
                return promiseChain.then(() => new Promise((resolve) => {
                    getVideoMetadata(item, resolve)
                }))
            }, Promise.resolve())

            let videometadata3 = quarterSlice1.reduce((promiseChain, item) => {
                return promiseChain.then(() => new Promise((resolve) => {
                    getVideoMetadata(item, resolve)
                }))
            }, Promise.resolve())

            let videometadata4 = quarterSlice2.reduce((promiseChain, item) => {
                return promiseChain.then(() => new Promise((resolve) => {
                    getVideoMetadata(item, resolve)
                }))
            }, Promise.resolve())

            videometadata1.then(() => {
                firstSideResolved = true
                done()
            })

            videometadata2.then(() => {
                secondSideResolved = true
                done()
            })

            videometadata3.then(() => {
                thirdSideResolved = true
                done()
            })

            videometadata4.then(() => {
                fourthSideResolved = true
                done()
            })
        }
    })
}

function downloadPlaylist(quality) {
    let halfSlice1 = filteredPlaylistVideos.slice(0)
    let halfSlice2 = halfSlice1.splice(0, Math.floor(halfSlice1.length / 2))
    let quarterSlice1 = halfSlice1.splice(0, Math.floor(halfSlice1.length / 2))
    let quarterSlice2 = halfSlice2.splice(0, Math.floor(halfSlice2.length / 2))

    let formatSlice1 = playlistFormatIDs.slice(0)
    let formatSlice2 = formatSlice1.splice(0, Math.floor(formatSlice1.length / 2))
    let formatSlice3 = formatSlice1.splice(0, Math.floor(formatSlice1.length / 2))
    let formatSlice4 = formatSlice2.splice(0, Math.floor(formatSlice2.length / 2))

    let procOneQueue = 0
    let procTwoQueue = 0
    let procThreeQueue = 0
    let procFourQueue = 0

    let firstSideResolved = false
    let secondSideResolved = false
    let thirdSideResolved = false
    let fourthSideResolved = false

    console.log("downloading playlist: " + selectedURL)
    let amountToDownload = filteredPlaylistVideos.length
    $('.completion.download').html("Video 0 of " + amountToDownload + " downloaded")
    if(process.platform === "win32") ipcRenderer.send('request-mainprocess-action', {mode: "downloading"})
    let videosDownloaded = 0

    function downloadVideo(item, format_id, queue, cb) {
        if(item.removed === "yes") {
            ++videosDownloaded
            queue++
            let percentage = ((videosDownloaded / amountToDownload) * 100) + "%"
            $('.progress-bar.download').css("width", percentage).attr("aria-valuenow", percentage.slice(0,-1))
            $('.completion.download').html("Video " + videosDownloaded + " of " + amountToDownload + " downloaded")
            cb()
            return
        }
        let options
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
                '-f', format_id[queue] + "+bestaudio[ext=m4a]/best+bestaudio[ext=m4a]",
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
        queue++
        callYTDL(item.webpage_url, options, {}, function(err, output) {
            if (err) showError(err)
            ++videosDownloaded
            let percentage = ((videosDownloaded / amountToDownload) * 100) + "%"
            $('.progress-bar.download').css("width", percentage).attr("aria-valuenow", percentage.slice(0,-1))
            $('.completion.download').html("Video " + videosDownloaded + " of " + amountToDownload + " downloaded")
            remote.getCurrentWindow().setProgressBar(videosDownloaded / amountToDownload)
            cb()
        })
    }

    function done() {
        if (!(firstSideResolved && secondSideResolved && thirdSideResolved && fourthSideResolved)) return
        downloadFinished()
        $('.completion.download').html("All videos downloaded")
    }

    let videometadata1 = halfSlice1.reduce((promiseChain, item) => {
        return promiseChain.then(() => new Promise((resolve) => {
            downloadVideo(item, formatSlice1, procOneQueue, resolve)
        }))
    }, Promise.resolve())

    let videometadata2 = halfSlice2.reduce((promiseChain, item) => {
        return promiseChain.then(() => new Promise((resolve) => {
            downloadVideo(item, formatSlice2, procTwoQueue, resolve)
        }))
    }, Promise.resolve())

    let videometadata3 = quarterSlice1.reduce((promiseChain, item) => {
        return promiseChain.then(() => new Promise((resolve) => {
            downloadVideo(item, formatSlice3, procThreeQueue, resolve)
        }))
    }, Promise.resolve())

    let videometadata4 = quarterSlice2.reduce((promiseChain, item) => {
        return promiseChain.then(() => new Promise((resolve) => {
            downloadVideo(item, formatSlice4, procFourQueue, resolve)
        }))
    }, Promise.resolve())

    videometadata1.then(() => {
        firstSideResolved = true
        console.log('first resolved')
        done()
    })

    videometadata2.then(() => {
        secondSideResolved = true
        console.log('second resolved')
        done()
    })

    videometadata3.then(() => {
        thirdSideResolved = true
        console.log('third resolved')
        done()
    })

    videometadata4.then(() => {
        fourthSideResolved = true
        console.log('fourth resolved')
        done()
    })
}
