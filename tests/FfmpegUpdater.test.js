const FfmpegUpdater = require("../modules/FfmpegUpdater");
const fs = require("fs");
const axios = require("axios");
const { PassThrough } = require('stream');
const os = require('os');

beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn().mockImplementation(() => {});
    console.log = jest.fn().mockImplementation(() => {});
})

describe("writeVersionInfo", () => {
    it('writes the version to a file', () => {
        jest.spyOn(fs.promises, 'writeFile').mockResolvedValue("");
        const instance = new FfmpegUpdater({ ffmpegVersion: "a/test/path" });
        instance.writeVersionInfo("v2.0.0-test1");
        expect(fs.promises.writeFile).toBeCalledTimes(1);
        expect(fs.promises.writeFile).toBeCalledWith("a/test/path", "{\"version\":\"v2.0.0-test1\"}");
    });
});

describe("getLocalVersion", () => {
    it('returns null when when the file does not exist', () => {
        jest.spyOn(fs.promises, 'readFile').mockRejectedValue("ENOTFOUND");
        const instance = new FfmpegUpdater({ ytdlVersion: "a/test/path" });
        return instance.getLocalVersion().then((data) => {
            expect(data).toBe(null);
        });
    });
    it('returns the version property from the json file', () => {
        jest.spyOn(fs.promises, 'readFile').mockResolvedValue("{\"version\": \"v2.0.0-test1\"}")
        jest.spyOn(fs.promises, 'access').mockResolvedValue("");
        const instance = new FfmpegUpdater({ ffmpegVersion: "a/test/path", ffmpeg: "ffmpeg/path" });
        return instance.getLocalVersion().then((data) => {
            expect(data).toBe("v2.0.0-test1");
        });
    });
    it('returns null when ffmpeg is unset or false', () => {
        jest.spyOn(fs.promises, 'readFile').mockResolvedValue("{\"version\": \"v2.0.0-test1\"}")
        jest.spyOn(fs.promises, 'access').mockResolvedValue("");
        const instance = new FfmpegUpdater({ ffmpegVersion: "a/test/path" });
        return instance.getLocalVersion().then((data) => {
            expect(data).toBe(null);
        });
    });
});

describe('getRemoteVersion', () => {
    it('returns null on error', () => {
        const axiosGetSpy = jest.spyOn(axios, 'get').mockRejectedValue({response: null});
        jest.spyOn(os, 'arch').mockReturnValue('x64');
        const instance = new FfmpegUpdater({platform: "darwin"});
        return instance.getRemoteVersion().then((data) => {
            expect(data).toEqual(null);
            expect(axiosGetSpy).toBeCalledTimes(1);
        });
    });
    it('returns object with the links and the version', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get').mockResolvedValue({
            data: { version: "4.2.1", bin: { "windows-32": { ffmpeg: "ffmpeg/link", ffprobe: "ffprobe/link" } } },
        });
        jest.spyOn(os, 'arch').mockReturnValue('ia32');
        Object.defineProperty(process, "platform", {
            value: "win32"
        });
        const instance = new FfmpegUpdater({platform: "win32"});
        const result = await instance.getRemoteVersion();
        expect(result).toEqual({
            remoteFfmpegUrl: "ffmpeg/link",
            remoteFfprobeUrl: "ffprobe/link",
            remoteVersion: "4.2.1"
        });
        expect(axiosGetSpy).toBeCalledTimes(1);
    });
});

describe('checkUpdate', () => {
    it('does nothing when local and remote version are the same', () => {
        const win = {webContents: {send: jest.fn()}};
        const instance = new FfmpegUpdater({platform: "win32"}, win);
        const downloadUpdateSpy = jest.spyOn(instance, 'downloadUpdate');
        jest.spyOn(instance, 'getLocalVersion').mockResolvedValue("v2.0.0");
        jest.spyOn(instance, 'getRemoteVersion').mockResolvedValue(["link", "v2.0.0"]);
        return instance.checkUpdate().then(() => {
            expect(downloadUpdateSpy).not.toBeCalled();
            expect(instance.win.webContents.send).not.toBeCalled();
        });
    });
    it('does nothing when remote version returned null', () => {
        const win = {webContents: {send: jest.fn()}};
        const instance = new FfmpegUpdater({platform: "win32"}, win);
        const downloadUpdateSpy = jest.spyOn(instance, 'downloadUpdate');
        jest.spyOn(instance, 'getLocalVersion').mockResolvedValue("v2.0.0");
        jest.spyOn(instance, 'getRemoteVersion').mockResolvedValue([null, null]);
        return instance.checkUpdate().then(() => {
            expect(downloadUpdateSpy).not.toBeCalled();
            expect(instance.win.webContents.send).not.toBeCalled();
        });
    });
    it('downloads the latest remote version when local version is null', () => {
        const win = {webContents: {send: jest.fn()}};
        const instance = new FfmpegUpdater({platform: "win32"}, win);
        const downloadUpdateSpy = jest.spyOn(instance, 'downloadUpdate').mockResolvedValue("");
        jest.spyOn(instance, 'getLocalVersion').mockResolvedValue(null);
        jest.spyOn(instance, 'getRemoteVersion').mockResolvedValue(["link", "v2.0.0"]);
        return instance.checkUpdate().then(() => {
            expect(downloadUpdateSpy).toBeCalledTimes(2);
            expect(instance.win.webContents.send).toBeCalledTimes(2);
        });
    });
    it('downloads the latest remote version when local version is different', () => {
        const win = {webContents: {send: jest.fn()}};
        const instance = new FfmpegUpdater({platform: "win32", ytdl: "a/path/to"}, win);
        const downloadUpdateSpy = jest.spyOn(instance, 'downloadUpdate').mockResolvedValue("");
        jest.spyOn(instance, 'getLocalVersion').mockResolvedValue("2021.03.10");
        jest.spyOn(instance, 'getRemoteVersion').mockResolvedValue({ remoteUrl: "link", remoteVersion: "2021.10.10" });
        return instance.checkUpdate().then(() => {
            expect(downloadUpdateSpy).toBeCalledTimes(2);
            expect(instance.win.webContents.send).toBeCalledTimes(2);
        });
    });
});
