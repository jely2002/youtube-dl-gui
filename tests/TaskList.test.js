const TaskList =  require('../modules/persistence/TaskList')
const fs = require('fs').promises;

beforeEach(() => {
    jest.clearAllMocks();
    fs.writeFile = jest.fn().mockResolvedValue("");
    fs.readFile = jest.fn().mockResolvedValue('["url1", "url2"]');
    console.log = jest.fn().mockImplementation(() => {});
});

describe("save", () => {
    it("writes the tasklist to a file", () => {
        const instance = instanceBuilder()
        instance.save()
        expect(instance.manager.getTaskList).toBeCalledTimes(1)
        expect(fs.writeFile).toBeCalledTimes(1)
    })
})

describe("load", () => {
    it("reads the tasklist from a file", () => {
        const instance = instanceBuilder()
        instance.load()
        expect(fs.readFile).toBeCalledTimes(1)
    })
    it("shows a restore toast", async () => {
        const instance = instanceBuilder()
        await instance.load()
        expect(instance.manager.window.webContents.send).toBeCalledTimes(1)
    })
    it("logs to console when the file does not exist", async () => {
        const instance = instanceBuilder()
        fs.readFile = jest.fn().mockRejectedValue("")
        await instance.load()
        expect(console.log).toBeCalledTimes(1)
    })
    it("logs to console when the file is empty", async () => {
        const instance = instanceBuilder()
        fs.readFile = jest.fn().mockResolvedValue("[]")
        await instance.load()
        expect(console.log).toBeCalledTimes(1)
    })
})

describe("restore", () => {
    it("loads the task list into query manager", async () => {
        const instance = instanceBuilder()
        await instance.restore()
        expect(instance.manager.loadTaskList).toBeCalledTimes(1)
    })
})

function instanceBuilder() {
    const paths = { taskList: "path/to/task/list" }
    const manager = { window: { webContents: { send: jest.fn() } }, getTaskList: jest.fn().mockResolvedValue(["url1", "url2"]), loadTaskList: jest.fn().mockResolvedValue("") }
    return new TaskList(paths, manager)
}
