'use strict'

let videoURLS = []
let filteredVideoURLS = []
let metaVideos = []

//Gets the playlist metadata (URL's and later one video formats) from YouTube or the local cache, and keeps the user updated during the process
function showPlaylistInfo(url) {
    setFetchingPlaylist()
    selectedURL = url
    let amountToDownload = 0
    let metadataDownloaded = 0
    function getVideoMetadata(item, cb) {
        callYTDL(item, ['-J', '--skip-download'], {}, function (err, output) {
            if(output == null) {
                ++metadataDownloaded
                metaVideos.push({removed: "yes", playlist_index: 0, webpage_url: item})
                setProgressBarProgress(true, metadataDownloaded, amountToDownload)
                setProgressBarText(true, "Fetching video metadata (%1 of %2)", metadataDownloaded, amountToDownload)
                cb()
                return
            }
            if (err) showError(err)
            let video = JSON.parse(output)
            metaVideos.push(video)
            ++metadataDownloaded
            setProgressBarProgress(true, metadataDownloaded, amountToDownload)
            setProgressBarText(true, "Fetching video metadata (%1 of %2)", metadataDownloaded, amountToDownload)
            cb()
        })
    }

    let playlistmetadata = new Promise((resolve, reject) => {
        callYTDL(selectedURL, ['-J', '--flat-playlist'], {}, function (err, output) {
            if(output == null) {
                if(err) console.log(err)
                setInvalidPlaylist()
                return
            }
            if (err) showError(err)
            let metadata = JSON.parse(output)
            amountToDownload = metadata.entries.length
            setPlaylistData(metadata, amountToDownload)
            metadata.entries.forEach(function (entry) {
                videoURLS.push("https://www.youtube.com/watch?v=" + entry.id)
                filteredVideoURLS.push("https://www.youtube.com/watch?v=" + entry.id)
            })
            setProgressBarText(true, "Fetching video metadata (%1 of %2)", metadataDownloaded, amountToDownload)
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
                    setProgressBarText(true, "Up-to-date cache found!", metadataDownloaded, amountToDownload)
                    playlistVideos = getCachedPlaylist(selectedURL)
                    firstSideResolved = true
                    secondSideResolved = true
                    thirdSideResolved = true
                    fourthSideResolved = true
                    setProgressBarProgress(true, 1, 1)
                    done()
                } else {
                    filteredVideoURLS = getCacheDifference(selectedURL)
                    amountToDownload = filteredVideoURLS.length
                    setProgressBarText(true, "Updating metadata cache (%1 of %2)", metadataDownloaded, amountToDownload)
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
            setProgressBarText(true, "Fetched all metadata!")
            setPlaylistAdvancedData(playlistVideos[0])
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

//Downloads the videos in filteredPlaylistVideos from YouTube, and keeps the user updated during the process.
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

    let amountToDownload = filteredPlaylistVideos.length
    let videosDownloaded = 0
    setProgressBarText(false, "Video %1 of %2 downloaded", videosDownloaded, amountToDownload)
    if(process.platform === "win32") ipcRenderer.send('request-mainprocess-action', {mode: "downloading"})

    function downloadVideo(item, format_id, queue, cb) {
        if(item.removed === "yes") {
            ++videosDownloaded
            queue++
            let percentage = ((videosDownloaded / amountToDownload) * 100) + "%"
            setProgressBarProgress(false, videosDownloaded, amountToDownload)
            setProgressBarText(false, "Video %1 of %2 downloaded", videosDownloaded, amountToDownload)
            cb()
            return
        }
        let options
        if(isAudio()) {
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
        if(isSubtitleChecked()) {
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
            setProgressBarProgress(false, videosDownloaded, amountToDownload)
            setProgressBarText(false, "Video %1 of %2 downloaded", videosDownloaded, amountToDownload)
            cb()
        })
    }

    function done() {
        if (!(firstSideResolved && secondSideResolved && thirdSideResolved && fourthSideResolved)) return
        downloadFinished()
        setProgressBarText(false, "All videos downloaded")
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
