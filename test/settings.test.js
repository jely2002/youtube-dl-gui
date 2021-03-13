const fs = require('fs').promises;
const os = require("os");
const Settings = require('../modules/Settings');
const env = {version: "2.0.0-test1"};
const correctSettings = new Settings({settings: "test/test-settings.json"}, env, false, true, "full", "49", 12, true, true, "C:\\Users\\user\\cookies.txt", false, true, false, false, true);
const defaultSettings = "{\"enforceMP4\":false,\"spoofUserAgent\":true,\"sizeMode\":\"full\",\"splitMode\":\"49\",\"maxConcurrent\":8,\"defaultConcurrent\":8,\"updateBinary\":true,\"updateApplication\":true,\"statSend\":false,\"downloadMetadata\":true,\"downloadThumbnail\":false,\"keepUnmerged\":false,\"calculateTotalSize\":true,\"version\":\"2.0.0-test1\"}"

beforeEach(() => {
    //Clear all mocks
    jest.clearAllMocks();
    //Disable console logging
    console.log = jest.fn().mockImplementation(() => {});
});

test('Load settings from file', () => {
    return Settings.loadFromFile({settings: "test/test-settings.json"}, env).then(data => {
       expect(data).toStrictEqual(correctSettings);
    });
});

test('Create new settings file on error', () => {
    os.cpus = jest.fn().mockImplementation(() => { return new Array(16) });
    fs.writeFile = jest.fn().mockResolvedValue("");
    return Settings.loadFromFile({settings: "test/non-existent-file.json"}, env).then((data) => {
        expect(data).toStrictEqual(new Settings({settings: "test/non-existent-file.json"}, env))
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        expect(fs.writeFile.mock.calls[0]).toContain("test/non-existent-file.json");
        expect(fs.writeFile.mock.calls[0]).toContain(defaultSettings);
    });
});

test('Update settings to file', () => {
    env.changeMaxConcurrent = jest.fn();
    env.appUpdater = { setUpdateSetting: jest.fn() };
    fs.writeFile = jest.fn().mockResolvedValue("");

    const changedDefault = JSON.parse(defaultSettings);
    changedDefault.maxConcurrent = 4;

    return Settings.loadFromFile({settings: "test/test-settings.json"}, env).then(data => {
        delete data.cookiePath;
        data.update(changedDefault);
        console.log(changedDefault)
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        expect(fs.writeFile.mock.calls[0]).toContain("test/test-settings.json");
        expect(changedDefault.maxConcurrent).toEqual(JSON.parse(fs.writeFile.mock.calls[0][1]).maxConcurrent);
    });
});

