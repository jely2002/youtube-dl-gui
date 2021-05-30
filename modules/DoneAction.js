const execa = require("execa");

const actions = {
    "win32": {
        "Sleep": ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"],
        "Lock": ["rundll32.exe", "user32.dll,LockWorkStation"],
        "Shutdown": ["shutdown", "/s", "/f", "/t", "0"],
        "Reboot": ["shutdown", "/r", "/f", "/t", "0"],
    },
    "linux": {
        "Sleep": ["systemctl", "suspend"],
        "Shutdown": ["shutdown", "-h", "now"],
        "Reboot": ["shutdown", "-r", "now"]
    },
    "darwin": {
        "Sleep": ["pmset", "sleepnow"],
        "Shutdown": ["shutdown", "-h", "now"],
        "Reboot": ["shutdown", "-r", "now"]
    }
}

class DoneAction {
    constructor() {
        this.platform = process.platform;
    }

    getActions() {
        return Object.keys(actions[this.platform]);
    }

    async executeAction(action) {
        if(action === "Close app") {
            process.exit(1);
            return;
        } else if(action === "Do nothing") {
            return;
        }
        const command = actions[this.platform][action][0];
        const args = actions[this.platform][action].slice(1);
        try {
            await execa(command, args);
        } catch(e) {
            console.error(e)
        }
    }

}

module.exports = DoneAction;
