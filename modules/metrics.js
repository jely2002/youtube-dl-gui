//metrics.js sends anonymous user data to a secured database
'use strict'
const os = require('os')

//Collect all the data
let Platform = process.platform
let Version = ipcRenderer.invoke('appInfo', 'version')
let ram = (process.getSystemMemoryInfo().total / 1.074e+6).toFixed(0)
let cpuModel = os.cpus()[0].model
let cpuCores = os.cpus().length
let country = ipcRenderer.invoke('appInfo', 'country')

let metricsID;
let appTrimPath

startMetrics()

//Create the unique MetricID's if they do not yet exist, and call sendInitialMetrics if the unique ID is not there.
async function startMetrics() {
    if(process.platform === "darwin") {
        let appTrimPathUncut = await ipcRenderer.invoke('getPath', 'appPath')
        appTrimPath = appTrimPathUncut.slice(0,-8)
    } else if(process.platform === "linux") {
        appTrimPath = await ipcRenderer.invoke('getPath', 'home') + "/.youtube-dl-gui/"
    } else {
        appTrimPath = "resources/"
    }
    fs.access(appTrimPath + "metricsID.txt", fs.F_OK, function(err) {
        if (err) {
            metricsID = generateUUID();
            fs.writeFile(appTrimPath + "metricsID.txt", metricsID, 'utf-8', function(err) {
                if(err) console.log(err)
                sendInitialMetrics()
            })
        } else {
            fs.readFile(appTrimPath + "metricsID.txt", 'utf-8', function (err, data) {
                if (err) console.log(err)
                metricsID = data
                sendInitialMetrics()
            })
        }
    })
}

//Send the data to the back-end
function sendInitialMetrics() {
    $.ajax({
        type: 'POST',
        url: 'http://backend.jelleglebbeek.com/youtubedl/metrics.php',
        dataType: 'json',
        data: {
            uuid: metricsID,
            version: Version,
            platform: Platform,
            memory: ram,
            cpumodel: cpuModel,
            cpucores: cpuCores,
            countrycode: country
        },
        success: function() {
            console.log("Metrics send.");
        }
    });
}

//Generates a UUID
function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
