//downloads.js sends a UUID bound to this install to update the download counter. This counter really motivates me to work on this project.
'use strict'

let ID;
let appTrimPath
let Version

start()

//Create the unique ID if it does not exist, and call sendDownload() if the ID is not there.
async function start() {
    Version = await ipcRenderer.invoke('appInfo', 'version')
    if(process.platform === "darwin") {
        let appTrimPathUncut = await ipcRenderer.invoke('getPath', 'appPath')
        appTrimPath = appTrimPathUncut.slice(0,-8)
    } else if(process.platform === "linux") {
        appTrimPath = await ipcRenderer.invoke('getPath', 'home') + "/.youtube-dl-gui/"
    } else {
        appTrimPath = "resources/"
    }
    fs.access(appTrimPath + "ID.txt", fs.F_OK, function(err) {
        if (err) {
            ID = generateUUID();
            fs.writeFile(appTrimPath + "ID.txt", ID, 'utf-8', function(err) {
                if(err) console.log(err)
                sendDownload()
            })
        }
    })
}

//Send the UUID and version to the back-end
function sendDownload() {
    $.ajax({
        type: 'POST',
        url: 'http://backend.jelleglebbeek.com/youtubedl/downloads.php',
        dataType: 'json',
        data: {
            uuid: ID,
            version: Version
        },
        success: function() {
            console.log("Updated download counter.");
        }
    });
}

//Generates a UUID
function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
