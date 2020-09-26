//updater.js manages the installed instance of youtube-dl
'use strict'
const request = require('request')

let defaultBin;
let defaultPath;
let filePath
let url = 'http://yt-dl.org/downloads/latest/youtube-dl'

//Sets the appropriate file paths depending on platform
if(process.platform === "darwin") {
    ipcRenderer.invoke('getPath', 'appPath').then((result) => {
        defaultBin = result.slice(0,-8)
        defaultPath = defaultBin + 'details'
        filePath = defaultBin + "youtube-dl-darwin"
    })
} else if(process.platform === "linux") {
    ipcRenderer.invoke('getPath', 'home').then((result) => {
        defaultBin = result + "/.youtube-dl-gui/"
        defaultPath = defaultBin + 'details'
        filePath = defaultBin + "youtube-dl-darwin"
    })
} else {
    defaultPath = "resources/details"
    filePath =  "resources/youtube-dl.exe"
    url = "http://yt-dl.org/downloads/latest/youtube-dl.exe"
}

//Calls for an update
update()

//Probes youtube-dl for new updates, and downloads them when needed.
async function update() {
    await initializeSettings()
    if(!getSetting('update_binary')) return
    binaryUpdating(true)
    request.get(url, { followRedirect: false }, async function (err, res) {
        if (err) {
            console.log(err)
            if(err.toString().includes('ENOTFOUND')) {
                $('#connection').toast('show')
                $('#connection').css('visibility','visible')
                $('#url').prop("disabled", true).attr("placeholder", "Please connect to the internet and restart this app")
                binaryUpdating(false)
            }
            return
        }
        if (res.statusCode !== 302) {
            binaryUpdating(false)
            return console.log('Did not get redirect for the latest version link. Status: ' + res.statusCode)
        }
        const newUrl = res.headers.location
        const newVersion = /yt-dl\.org\/downloads\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(newUrl)[1]
        console.log("Latest release: " + newVersion)
        let currentVersion = await getCurrentVersion()
        if(newVersion === currentVersion) {
            binaryUpdating(false)
            console.log("Binaries were already up-to-date!")
        } else if(currentVersion == null) {
            console.log("Binaries may be corrupted, reinstalling...")
            downloadUpdate(newUrl, newVersion)
        } else {
            console.log("New version found! Updating...")
            downloadUpdate(newUrl, newVersion)
        }
    })
}

//Shows the currently downloaded version of youtube-dl
async function getCurrentVersion() {
    const call = new Promise((resolve, reject) => {
        fs.readFile(defaultPath, (err, data) => {
            if (err) {
                console.error(err)
                resolve(null)
                return
            }
            let detailsData
            try {
                detailsData = JSON.parse(data)
            } catch (error) {
                console.error(error)
                resolve(null)
                return
            }
            resolve(detailsData)
        });
    })
    let details = await call
    if(details == null) {
        return null
    } else {
        console.log("Current version: " + details.version)
        return details.version
    }
}

function downloadUpdate(newUrl, newVersion) {
    const downloadFile = request.get(newUrl)
    downloadFile.on('response', function response(res) {
        if (res.statusCode !== 200) {
            console.log('Response Error: ' + res.statusCode)
            return
        }
        downloadFile.pipe(fs.createWriteStream(filePath, {mode: 493}))
    })
    downloadFile.on('error', function error(err) {
        console.log(err)
    })
    downloadFile.on('end', function end() {
        binaryUpdating(false)
        console.log("New youtube-dl version downloaded: " + newVersion)
        console.log("Writing version data...")
        fs.writeFileSync(
            defaultPath,
            JSON.stringify({
                version: newVersion,
                path: filePath
            }),
            'utf8'
        )
        if (process.platform === "darwin" || process.platform === "linux") {
            console.log("Adding chmod permissions")
            fs.chmod(filePath, 0o755, function (err) {
                if (err) console.log(err)
                console.log("chmod 0755 added")
            })
        }
    })
}
