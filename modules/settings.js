let settingsPath;
let currentSettings;

$('.saveSettingsBtn').on('click', (element) => {
    $('#settingsModal').modal('hide')
    saveSettings()
})

$('.settingsIcon').on('click', (element) => {
    loadSettings()
    $('#settingsModal').modal()
})

async function getSettingPaths() {
    //Sets the appropriate file paths depending on platform
    if(process.platform === "darwin") {
        let result = await ipcRenderer.invoke('getPath', 'appPath')
        return result.slice(0,-8) + 'settings'

    } else if(process.platform === "linux") {
        let result = await ipcRenderer.invoke('getPath', 'home')
        return result + "/.youtube-dl-gui/" + 'settings'
    } else {
        return "resources/settings"
    }
}


async function initializeSettings() {
    settingsPath = await getSettingPaths()
    const call = new Promise((resolve, reject) => {
        fs.readFile(settingsPath, (err, data) => {
            if (err) {
                console.log(err)
                resolve(null)
                return
            }
            let settingsData
            try {
                settingsData = JSON.parse(data)
            } catch (error) {
                console.log(error)
                resolve(null)
                return
            }
            resolve(settingsData)
        });
    })
    let settings = await call
    if(settings == null) {
        createSettings()
    } else {
        currentSettings = settings
        console.log("Settings loaded from file")
    }
}

function getSetting(settingName) {
    return currentSettings[settingName]
}

function saveSettings() {
    console.log('Settings saved to file')
    let newSettings = {}
    $(".checkboxSetting").each(function() {
        newSettings[$(this).attr('json')] = $(this).prop('checked')
        currentSettings[$(this).attr('json')] = $(this).prop('checked')
    })
    fs.writeFile(settingsPath, JSON.stringify(newSettings), (err) => {
        if(err) {
            console.log(err)
        }
    })
}

function loadSettings() {
    $(".checkboxSetting").each(function() {
        $(this).prop('checked',currentSettings[$(this).attr('json')])
    })
}

function createSettings() {
    console.log('Creating new settings file')
    currentSettings = {
        "update_app": true,
        "update_binary": true
    }
    fs.writeFile(settingsPath, JSON.stringify(currentSettings), (err) => {
        if(err) {
            console.log(err)
        }
    })
}

