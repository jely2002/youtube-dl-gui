//updater.js manages the installed instance of youtube-dl
'use strict'
const request = require('request')

let defaultBin;
let defaultPath;
let filePath
let url = 'http://yt-dl.org/downloads/latest/youtube-dl'

//Sets the appropriate file paths depending on platform
if(process.platform === "darwin") {
    defaultBin = remote.app.getAppPath().slice(0, -8)
    defaultPath = defaultBin + 'details'
    filePath = defaultBin + "youtube-dl-darwin"
} else if(process.platform === "linux") {
    defaultBin = remote.app.getPath("home") + "/.youtube-dl-gui/"
    defaultPath = defaultBin + 'details'
    filePath = defaultBin + "youtube-dl-darwin"
} else {
    defaultPath = "resources/details"
    filePath =  "resources/youtube-dl.exe"
    url = "http://yt-dl.org/downloads/latest/youtube-dl.exe"
}

//Calls for an update
update()

//Probes youtube-dl for new updates, and downloads them when needed.
function update() {
    binaryUpdating(true)
    request.get(url, { followRedirect: false }, function (err, res) {
        if (err) {
            console.log(err)
            if(err.toString().includes('ENOTFOUND')) {
                $('#connection').toast('show')
                $('#connection').css('visibility','visible')
                $('#url').prop("disabled", true).attr("placeholder", "Please connect to the internet and restart this app")
            }
            return
        }
        if (res.statusCode !== 302) {
            return console.log('Did not get redirect for the latest version link. Status: ' + res.statusCode)
        }
        const newUrl = res.headers.location
        const newVersion = /yt-dl\.org\/downloads\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(newUrl)[1]
        console.log("Latest release: " + newVersion)
        if(newVersion === getCurrentVersion()) {
            binaryUpdating(false)
            console.log("Binaries were already up-to-date!")
        } else {
            console.log("New version found! Updating...")
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
                if(process.platform === "darwin" || process.platform === "linux") {
                    console.log("Adding chmod permissions")
                    fs.chmod(filePath, 0o755, function(err){
                        if(err) console.log(err)
                        console.log("chmod 0755 added")
                    })
                }
            })
        }
    })
}

//Shows the currently downloaded version of youtube-dl
function getCurrentVersion() {
    let details = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'))
    console.log("Current version: " + details.version)
    return details.version;

}
