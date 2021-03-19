const fs = require("fs");
const Filepaths = require("../modules/Filepaths");
const mkdirp = require("mkdirp");
const path = require("path");

jest.mock('mkdirp');

beforeEach(() => {
    jest.clearAllMocks();
    fs.chmod = jest.fn();
    jest.doMock('mkdirp', () => {
        const originalModule = jest.requireActual('mkdirp')
        return {
            __esModule: true,
            ...originalModule,
            mkdirp: jest.fn()
        }
    });
});

describe('set executable permissions', () => {
   it('sets the chmod of ytdl and ffmpeg to 0o755', () => {
       const instance = instanceBuilder(true);
       instance.ytdl = "ytdl/path/test.exe";
       instance.ffmpeg = "ffmpeg/path/test.exe";
       instance.setPermissions();
       expect(fs.chmod).toBeCalledTimes(2);
       expect(fs.chmod.mock.calls[0]).toContain(instance.ytdl);
       expect(fs.chmod.mock.calls[0]).toContain(493);
       expect(fs.chmod.mock.calls[1]).toContain(instance.ffmpeg);
       expect(fs.chmod.mock.calls[1]).toContain(493);
   });
});

describe('generate filepaths', () => {
   it('sets the unpacked and packed prefix', async () => {
       const platforms = ["win32", "linux", "darwin"];
       for(const platform of platforms) {
           const instance = instanceBuilder(true);
           instance.platform = platform;
           instance.setPermissions = jest.fn();
           instance.createHomeFolder = jest.fn().mockResolvedValue(undefined);
           await instance.generateFilepaths();
           expect(instance.packedPrefix).toBeTruthy();
           expect(instance.unpackedPrefix).toBeTruthy();
           if(platform === "linux") expect(instance.persistentPath).toBeTruthy();
       }
   });
    it('does not add prefixes when not packaged', async () => {
        const platforms = ["win32", "linux", "darwin"];
        for(const platform of platforms) {
            const instance = instanceBuilder(false);
            instance.platform = platform;
            instance.setPermissions = jest.fn();
            instance.createHomeFolder = jest.fn().mockResolvedValue(undefined);
            path.join = jest.fn();
            await instance.generateFilepaths();
            if(platform === "linux") expect(path.join).toBeCalledTimes(1);
            else expect(path.join).not.toBeCalled();
        }
    });
   it('calls create home folder on linux', async () => {
       const instance = instanceBuilder(true);
       instance.platform = "linux";
       instance.setPermissions = jest.fn();
       instance.createHomeFolder = jest.fn().mockResolvedValue(undefined);
       await instance.generateFilepaths();
       expect(instance.createHomeFolder).toBeCalledTimes(1);
   });
   it('sets permissions on darwin and linux', async () => {
       const platforms = ["win32", "linux", "darwin"];
       for(const platform of platforms) {
           const instance = instanceBuilder(true);
           instance.platform = platform;
           instance.setPermissions = jest.fn();
           instance.createHomeFolder = jest.fn().mockResolvedValue(undefined);
           await instance.generateFilepaths();
           if(platform === "win32") expect(instance.setPermissions).not.toBeCalled();
           else expect(instance.setPermissions).toBeCalledTimes(platform.indexOf(platform) + 1);
       }
   });
});

describe('create home folder', () => {
    it('does not copy the files if the folder already exists', async () => {
        const instance = instanceBuilder(true);
        fs.copyFileSync = jest.fn();
        mkdirp.mockResolvedValue(null);
        await instance.createHomeFolder();
        expect(fs.copyFileSync).not.toBeCalled();
    });
    it('copies 3 files if the directory did not exist yet', async () => {
        const instance = instanceBuilder(true);
        fs.copyFileSync = jest.fn();
        path.join = jest.fn();
        mkdirp.mockResolvedValue("path/to/made/directory");
        await instance.createHomeFolder();
        expect(fs.copyFileSync).toBeCalledTimes(3);
    });
});

function instanceBuilder(packaged) {
    const app = {
        isPackaged: packaged,
        getPath: jest.fn(() => "path/to/downloads"),
        getAppPath: jest.fn(() => "path/to/application")
    }
    return new Filepaths(app);
}
