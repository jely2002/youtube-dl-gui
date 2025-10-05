const ErrorHandler = require("../modules/exceptions/ErrorHandler");
const Utils = require("../modules/Utils");

describe('raiseError', () => {
   it('does not raise an error if the video type is playlist', async () => {
       console.error = jest.fn(() => {
       });
       const instance = await instanceBuilder();
       instance.queryManager.getVideo.mockReturnValue({type: "playlist", identifier: "test__identifier"});
       instance.raiseError(instance.errorDefinitions[1], "test__identifier");
       expect(instance.win.webContents.send).not.toBeCalled();
       expect(instance.queryManager.onError).not.toBeCalled();
   });
   it('sends the error to the renderer process', async () => {
       const instance = await instanceBuilder();
       instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
       instance.raiseError(instance.errorDefinitions[1], "test__identifier");
       expect(instance.win.webContents.send).toBeCalledTimes(1);
   });
   it('calls onError to mark the video as errored', async () => {
       const instance = await instanceBuilder();
       instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
       instance.raiseError(instance.errorDefinitions[1], "test__identifier");
       expect(instance.queryManager.onError).toBeCalledWith("test__identifier");
   });
});

describe('raiseUnhandledError', () => {
    it('does not raise an error if the video type is playlist', async () => {
        const instance = await instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "playlist", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__unhandled_desc", "test__identifier");
        expect(instance.win.webContents.send).not.toBeCalled();
        expect(instance.queryManager.onError).not.toBeCalled();
    });
    it('adds the error to the unhandled error list', async () => {
        const randomIDSpy = jest.spyOn(Utils, 'getRandomID').mockReturnValueOnce("12345678");
        const instance = await instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__unhandled_desc", "test__identifier");
        expect(instance.unhandledErrors).toContainEqual({
            identifier: "test__identifier",
            unexpected: true,
            error_id: "12345678",
            error: {
                code: "test__unhandled",
                description: "test__unhandled_desc",
            }
        });
        randomIDSpy.mockRestore();
    });
    it('sends the error to the renderer process', async () => {
        const instance = await instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__unhandled_desc", "test__identifier");
        expect(instance.win.webContents.send).toBeCalledTimes(1);
    });
    it('calls onError to mark the video as errored', async () => {
        const instance = await instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__unhandled_desc", "test__identifier");
        expect(instance.queryManager.onError).toBeCalledWith("test__identifier");
    });
});

describe('checkError', () => {
   it('Raises an error if the message matches a trigger', async () => {
       const instance = await instanceBuilder();
       instance.raiseError = jest.fn();
       instance.checkError("ERROR: is not a valid URL", "test__identifier");
       expect(instance.raiseError).toBeCalledWith({
           code: "URL not supported",
           description: "This URL is currently not supported by YTDL.",
           trigger: "is not a valid URL"
       }, "test__identifier");
   });
   it('Raises no ffmpeg error when in dev mode', async () => {
       process.argv = ["", "", "--dev"]; //Set dev mode enabled
       const instance = await instanceBuilder();
       instance.raiseError = jest.fn();
       instance.checkError("ERROR: ffmpeg or avconv not found", "test__identifier");
       expect(instance.raiseError).not.toBeCalled();
   });
   it('Raises an unhandled error if no trigger matches', async () => {
       const instance = await instanceBuilder();
       instance.raiseError = jest.fn();
       instance.raiseUnhandledError = jest.fn();
       instance.checkError("ERROR: this is some weird kinda error");
       expect(instance.raiseUnhandledError).toBeCalledTimes(1);
       expect(instance.raiseError).not.toBeCalled();
   });
});

async function instanceBuilder() {
    const env = {
        settings: {
            testSetting: true
        },
        paths: {
            app: {
                isPackaged: false
            },
            packedPrefix: "a/prefix",
            testPath: "a/path/yes.txt"
        }
    };
    const win = {
        webContents: {
            send: jest.fn()
        }
    };
    const queryManager = {
        getVideo: jest.fn(),
        onError: jest.fn()
    };
    const errorHandler = new ErrorHandler(win, queryManager, env);
    errorHandler.errorDefinitions = await errorHandler.loadErrorDefinitions();
    return errorHandler;
}
