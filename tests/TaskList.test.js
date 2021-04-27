const TaskList =  require('../modules/persistence/TaskList')
const fs = require('fs').promises;

beforeEach(() => {
    jest.clearAllMocks();
    fs.writeFile = jest.fn().mockResolvedValue("");
    fs.readFile = jest.fn().mockResolvedValue('["url1", "url2"]');
    console.log = jest.fn().mockImplementation(() => {});
});

describe("saveTaskList", () => {
    it("writes the tasklist to a file", () => {
        const instance = instanceBuilder()
        instance.saveTaskList()
        expect(instance.manager.getTaskList).toBeCalledTimes(1)
        expect(fs.writeFile).toBeCalledTimes(1)
    })
})

describe("loadTaskList", () => {
    it("reads the tasklist from a file", () => {
        const instance = instanceBuilder()
        instance.loadTaskList()
        expect(fs.readFile).toBeCalledTimes(1)
    })
    it("loads the task list into query manager", async () => {
        const instance = instanceBuilder()
        await instance.loadTaskList()
        expect(instance.manager.loadTaskList).toBeCalledTimes(1)
    })
    it("logs to console when the file does not exist", async () => {
        const instance = instanceBuilder()
        fs.readFile = jest.fn().mockRejectedValue("")
        await instance.loadTaskList()
        expect(console.log).toBeCalledTimes(1)
    })
})

function instanceBuilder() {
    const paths = { taskList: "path/to/task/list" }
    const manager = { getTaskList: jest.fn().mockResolvedValue(["url1", "url2"]), loadTaskList: jest.fn().mockResolvedValue("") }
    return new TaskList(paths, manager)
}
