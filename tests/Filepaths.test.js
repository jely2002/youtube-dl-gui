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
            const joinSpy = jest.spyOn(path, 'join').mockReturnValue("path");
            await instance.generateFilepaths();
            if(platform === "linux" || platform === "win32") expect(joinSpy).toBeCalledTimes(1);
            else expect(joinSpy).not.toBeCalled();
            joinSpy.mockRestore();
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
   it('calls create portable folder when this version is used', async () => {
       const instance = instanceBuilder(true, true);
       instance.platform = "win32portable";
       process.env.PORTABLE_EXECUTABLE_DIR = "test/dir/for/portable/executable";
       instance.createPortableFolder = jest.fn().mockResolvedValue(undefined);
       await instance.generateFilepaths();
       expect(instance.createPortableFolder).toBeCalledTimes(1);
   })
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
        instance.unpackedPrefix = "test/unpacked/prefix";
        fs.copyFileSync = jest.fn();
        mkdirp.mockResolvedValue(null);
        await instance.createHomeFolder();
        expect(fs.copyFileSync).not.toBeCalled();
    });
    it('copies 3 files if the directory did not exist yet', async () => {
        const instance = instanceBuilder(true);
        fs.copyFileSync = jest.fn();
        const joinSpy = jest.spyOn(path, 'join').mockReturnValue("path");
        mkdirp.mockResolvedValue("path/to/made/directory");
        await instance.createHomeFolder();
        expect(fs.copyFileSync).toBeCalledTimes(3);
        joinSpy.mockRestore();
    });
});

describe('create portable folder', () => {
    it('does not copy the files if the folder already exists', async () => {
        const instance = instanceBuilder(true);
        instance.unpackedPrefix = "test/unpacked/prefix";
        fs.copyFileSync = jest.fn();
        mkdirp.mockResolvedValue(null);
        await instance.createAppDataFolder();
        expect(fs.copyFileSync).not.toBeCalled();
    });
    it('copies 4 files if the directory did not exist yet', async () => {
        const instance = instanceBuilder(true);
        fs.copyFileSync = jest.fn();
        const joinSpy = jest.spyOn(path, 'join').mockReturnValue("path");
        mkdirp.mockResolvedValue("path/to/made/directory");
        await instance.createAppDataFolder()
        expect(fs.copyFileSync).toBeCalledTimes(4);
        joinSpy.mockRestore();
    });
});

describe('checkFfmpeg', () => {
    it('should do nothing when ffmpeg exists', () => {
        const instance = instanceBuilder(true);
        instance.ffmpeg = "ffmpeg/path";
        fs.copyFileSync = jest.fn();
        fs.promises.access = jest.fn().mockResolvedValue(true);
        instance.checkFfmpeg();
        expect(fs.copyFileSync).toBeCalledTimes(0);
    });
});



function instanceBuilder(packaged, portable) {
    const app = {
        isPackaged: packaged,
        getPath: jest.fn(() => "path/to/downloads"),
        getAppPath: jest.fn(() => portable ? "\\AppData\\Local\\Temp\\" : "path/to/application")
    }
    return new Filepaths(app);
}
