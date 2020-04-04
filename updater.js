'use strict'
const request = require('request')

let defaultBin;
let defaultPath;
let filePath
let url = 'https://yt-dl.org/downloads/latest/youtube-dl'

if(process.platform === "darwin") {
    defaultBin = remote.app.getAppPath().slice(0, -8)
    defaultPath = defaultBin + 'details'
    filePath = defaultBin + "youtube-dl-darwin"
} else {
    defaultPath = "resources/details"
    filePath =  "resources/youtube-dl.exe"
    url = "https://yt-dl.org/downloads/latest/youtube-dl.exe"
}

update()

function update() {
    request.get(url, { followRedirect: false }, function (err, res) {
        if (err) {
            console.log(err)
            if(err.toString().includes('ENOTFOUND')) {
                $('#connection').toast('show')
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
            })
        }
    })
}

function getCurrentVersion() {
   let details = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'))
    console.log("Current version: " + details.version)
    return details.version;

}
