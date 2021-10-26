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
       instance.ffmpeg = "ffmpeg/path/";
       const ytdlp = "yt-dlp.exe";
       const taskList = "taskList";
       fs.readdirSync = jest.fn().mockReturnValue([ytdlp, taskList]);
       instance.setPermissions();
       expect(fs.chmod).toBeCalledTimes(1);
       expect(fs.chmod.mock.calls[0]).toContain(path.join(instance.ffmpeg, ytdlp));
       expect(fs.chmod.mock.calls[0]).toContain(493);
   });
});

describe('generate filepaths', () => {
   it('sets the unpacked and packed prefix', async () => {
       const platforms = ["win32", "linux", "darwin"];
       for(const platform of platforms) {
           const instance = instanceBuilder(true);
           instance.platform = platform;
           instance.setPermissions = jest.fn();
           instance.createFolder = jest.fn().mockResolvedValue(undefined);
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
            instance.createFolder = jest.fn().mockResolvedValue(undefined);
            const joinSpy = jest.spyOn(path, 'join').mockReturnValue("path");
            jest.spyOn(instance, 'removeLeftOver').mockImplementation(() => Promise.resolve());
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
       instance.createFolder = jest.fn().mockResolvedValue(undefined);
       await instance.generateFilepaths();
       expect(instance.createFolder).toBeCalledTimes(1);
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
           instance.createFolder = jest.fn().mockResolvedValue(undefined);
           await instance.generateFilepaths();
           if(platform === "win32") expect(instance.setPermissions).not.toBeCalled();
           else expect(instance.setPermissions).toBeCalledTimes(platform.indexOf(platform) + 1);
       }
   });
});

describe('removeLeftOver', () => {
    it('removes youtube-dl.exe on win32', async () => {
        Object.defineProperty(process, "platform", {
            value: "win32"
        });
        const instance = instanceBuilder(true);
        instance.ffmpeg = "ffmpeg/path";
        fs.existsSync = jest.fn().mockImplementation(() => true);
        fs.promises.unlink = jest.fn().mockImplementation(() => Promise.resolve());

        await instance.removeLeftOver();

        expect(fs.promises.unlink).toBeCalledTimes(1);
        expect(fs.promises.unlink).toBeCalledWith(path.join("ffmpeg/path", "youtube-dl.exe"));
    });
    it('removes youtube-dl-unix on other systems', async () => {
        Object.defineProperty(process, "platform", {
            value: "darwin"
        });
        const instance = instanceBuilder(true);
        instance.ffmpeg = "ffmpeg/path";
        fs.existsSync = jest.fn().mockImplementation(() => true);
        fs.promises.unlink = jest.fn().mockImplementation(() => Promise.resolve());

        await instance.removeLeftOver();

        expect(fs.promises.unlink).toBeCalledTimes(1);
        expect(fs.promises.unlink).toBeCalledWith(path.join("ffmpeg/path", "youtube-dl-unix"));
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
