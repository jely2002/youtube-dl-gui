let cachePath
const { ipcRenderer } = require('electron')
//Create caching directory if it does not exist yet, and set the path to it
async function initCaching() {
    if(process.platform === "win32") {
        cachePath = 'resources/cached/'
	createPath()
    } else if(process.platform === "linux") {
        ipcRenderer.invoke('getPath', 'home').then((result) => {
            cachePath = result + "/.youtube-dl-gui/cached/"
            createPath()
        })
    } else {
        ipcRenderer.invoke('getPath', 'appPath').then((result) => {
	    cachePath = result.slice(0, -8) + 'cached/'
            createPath()
	})
    }
}

//Receives IPC event to flush the cache
ipcRenderer.on('flushCache', () => flushCache())

//Flushes the cache by deleting all files in /cached
function flushCache() {
    let files = fs.readdirSync(cachePath)
    files.forEach(file => {
       fs.unlinkSync(cachePath + file)
    });
    console.log('Cache flushed succesfully')
    alert('Cache flushed succesfully')
}

async function createPath() {
  try {
        await fs.promises.access(cachePath);
        console.log('Cached directory exists')
    } catch (error) {
        await fs.promises.mkdir(cachePath)
        console.log('Created cached directory (first launch)')
    }
}

//Check if a cache is available for the given playlist url, and return the cache if found.
function cacheAvailable(url) {
    let id = urlToId(url)
    let foundCache = false
    let files = fs.readdirSync(cachePath)
    files.forEach(file => {
        if(file === id) {
            foundCache = true
        }
    });
    return foundCache
}

//Check if cache is up-to-date with the videos currently in the online playlist
function isCacheUpToDate(url) {
    let id = urlToId(url)
    let cachedURLS = []
    let data = JSON.parse(fs.readFileSync(cachePath + id, 'utf8'))
    data.forEach(video => {
        cachedURLS.push(video.webpage_url)
    })
    let difference = cachedURLS
        .filter(x => !videoURLS.includes(x))
        .concat(videoURLS.filter(x => !cachedURLS.includes(x)));
    let removedVideos = cachedURLS.filter( function( el ) {
        return videoURLS.indexOf( el ) < 0;
    });
    if(removedVideos.length > 0 && difference.length === removedVideos.length) {
        return true
    } else if(removedVideos.length > 0 && difference.length > removedVideos.length) {
        return false
    }
    if(difference.length > 0) {
        return false
    } else {
        return true
    }
}

//Get the difference between the local cache and the online playlist, and return the video URL's
function getCacheDifference(url) {
    let id = urlToId(url)
    let cachedURLS = []
    let data = JSON.parse(fs.readFileSync(cachePath + id, 'utf8'))
    data.forEach(video => {
        cachedURLS.push(video.webpage_url)
    })
    let difference = cachedURLS
        .filter(x => !videoURLS.includes(x))
        .concat(videoURLS.filter(x => !cachedURLS.includes(x)))
    let removedVideos = cachedURLS.filter( function( el ) {
        return videoURLS.indexOf( el ) < 0;
    });
    if(difference.length > 0) {
        return difference.filter( ( el ) => !removedVideos.includes( el ) )
    } else {
        return null
    }
}

//Get cached information about a playlist using the URL
function getCachedPlaylist(url) {
    let id = urlToId(url)
    if (cacheAvailable(url)) {
        let videos = fs.readFileSync(cachePath + id, 'utf8')
        return JSON.parse(videos)
    }
}

//Add a playlist to the cache with the URL and the video data
function addCachedPlaylist(url, data) {
    let id = urlToId(url)
    if(cacheAvailable(url)) {
        updateCachedPlaylist(url)
    }  else {
        playlistVideos = metaVideos.slice(0)
        fs.writeFile(cachePath + id, JSON.stringify(data), (err) => {
            if (err) console.log(err)
        })
    }
}

//Remove videos from cache using the playlist URL
function removeVideosFromCache(url, cb) {
    let id = urlToId(url)
    let cachedURLS = []
    let currentCache = JSON.parse(fs.readFileSync(cachePath + id, 'utf8'))
    currentCache.forEach(video => {
        cachedURLS.push(video.webpage_url)
    })
    let removedVideos = cachedURLS.filter( function(el) {
        return videoURLS.indexOf(el) < 0;
    });
    if(removedVideos.length === 0) {
        cb()
        return
    }
    let removedCache = currentCache.filter( function(el) {
        return !removedVideos.includes(el.webpage_url)
    })
    fs.unlink(cachePath + id, function(err) {
        if(err) console.log(err)
        fs.writeFile(cachePath + id, JSON.stringify(removedCache), (err) => {
            if (err) console.log(err)
            cb()
        })
    })
}

//Update an already cached playlist with newly added videos
function updateCachedPlaylist(url) {
    if(isCacheUpToDate(url)) return
    let id = urlToId(url)
    let totalVideos = getCachedPlaylist(url)
    metaVideos.forEach(video => {
        totalVideos.push(video)
    })
    playlistVideos = totalVideos.slice(0)
    fs.unlink(cachePath + id, function(err) {
        if(err) console.log(err)
        fs.writeFile(cachePath + id, JSON.stringify(totalVideos), (err) => {
            if (err) console.log(err)
        })
    })
}

//Transforms a video URL into a video ID
function urlToId(url) {
    return /\?(?:v|list)=(\w*)/g.exec(url)[1]
}
