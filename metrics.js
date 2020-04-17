'use strict'
const os = require('os')

let Platform = process.platform
let Version = remote.app.getVersion()
let ram = (process.getSystemMemoryInfo().total / 1.074e+6).toFixed(0)
let cpuModel = os.cpus()[0].model
let cpuCores = os.cpus().length
let country = remote.app.getLocaleCountryCode()

let metricsID;
let appTrimPath

startMetrics()

function startMetrics() {
    if(process.platform === "darwin") {
        appTrimPath = remote.app.getAppPath().slice(0, -8)
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

function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
