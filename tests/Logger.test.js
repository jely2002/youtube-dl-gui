const fs = require("fs").promises;
const {dialog} = require("electron");
const Logger =  require("../modules/persistence/Logger");

const downloadPath = "a/download/path";
const savePath = "path/to/log";

jest.mock('electron', () => ({
    dialog: {
        showSaveDialog: jest.fn().mockResolvedValue({canceled: false, filePath: "path/to/log"}),
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    fs.writeFile = jest.fn().mockResolvedValue("");
    console.log = jest.fn().mockImplementation(() => {});
});

describe("log", () => {
    it("adds the line to the log", () => {
        const instance = instanceBuilder();
        instance.logs = {
            "identifier": ["first line"]
        }
        instance.log("identifier", "second line");
        expect(instance.logs.identifier).toEqual(["first line", "second line"]);
    });
    it("creates a new log if it doesn't exist", () => {
        const instance = instanceBuilder();
        instance.log("identifier", "first line");
        expect(instance.logs["identifier"]).toEqual(["first line"]);
    });
    it("Replaces done and killed with readable values", () => {
        const values = [{val: "done", res: "Download finished"}, {val: "killed", res: "Download stopped"}];
        for(const value of values) {
            const instance = instanceBuilder();
            instance.log("identifier", value.val);
            expect(instance.logs["identifier"]).toEqual([value.res]);
        }
    });
    it("trims all new lines from the log line", () => {
        const instance = instanceBuilder();
        instance.log("identifier", "\nfirst line \na line break\n");
        expect(instance.logs["identifier"]).toEqual(["first line a line break"]);
    });
    it("ignores the call if the line is empty or falsy", () => {
        const instance = instanceBuilder();
        const values = ["", null, undefined];
        for(const value of values) {
            instance.log("identifier", value);
            expect(instance.logs["identifier"]).toBeUndefined();
        }
    })
});

describe("get", () => {
    it("returns the log associated with the identifier", () => {
        const instance = instanceBuilder();
        const log =  ["first line", "second line"];
        const identifier = "identifier";
        instance.logs[identifier] = log;
        expect(instance.get(identifier)).toEqual(log);
    });
});

describe("clear", () => {
    it("removes the log associated with the identifier", () => {
        const instance = instanceBuilder();
        const identifier = "identifier";
        instance.logs[identifier] = ["first line"];
        instance.clear(identifier);
        expect(instance.logs[identifier]).toBeUndefined();
    });
});

describe("save", () => {
    it("saves the log", async () => {
        const instance = instanceBuilder();
        const log = ["first line", "second line"];
        const identifier = "identifier";

        instance.logs[identifier] = log;
        await instance.save(identifier);
        expect(fs.writeFile).toBeCalledTimes(1);
        expect(fs.writeFile).toHaveBeenCalledWith(savePath, "first line\nsecond line\n");
    });
    it("asks the user where to save", async () => {
        const instance = instanceBuilder();
        const log = ["first line", "second line"];
        const identifier = "identifier";

        instance.logs[identifier] = log;
        await instance.save(identifier);
        expect(dialog.showSaveDialog).toBeCalledTimes(1);
    });
    it("doesn't save when the user cancels", async () => {
        dialog.showSaveDialog = jest.fn().mockResolvedValue({canceled: true, filePath: "path/to/log"})
        const instance = instanceBuilder();
        const log = ["first line", "second line"];
        const identifier = "identifier";
        instance.logs[identifier] = log;
        await instance.save(identifier);
        expect(fs.writeFile).not.toBeCalled();
    })
})

function instanceBuilder() {
    const environment = {
        win: "i'm a window",
        settings: {
            downloadPath: downloadPath
        }
    }
    return new Logger(environment);
}
