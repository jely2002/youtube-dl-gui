const fs = require('fs').promises

class TaskList {
    constructor(paths, manager) {
        this.paths = paths
        this.manager = manager
    }

    async saveTaskList() {
        const taskList = this.manager.getTaskList();
        await fs.writeFile(this.paths.taskList, JSON.stringify(taskList))
    }

    async loadTaskList() {
        try {
            const data = await fs.readFile(this.paths.taskList)
            this.manager.loadTaskList(JSON.parse(data))
        } catch(err) {
            console.log("No saved taskList found.")
        }
    }
}

module.exports = TaskList
