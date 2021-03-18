const ErrorHandler = require("../modules/ErrorHandler");

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reportError', () => {
    it('calls sendReport with the appropriate error', async () => {
        const instance = instanceBuilder();
        instance.unhandledErrors.push({
            identifier: "test__identifier",
            unexpected: true,
            error: {
                code: "Unhandled exception",
                description: "test__unhandled",
            }
        });
        instance.queryManager.getVideo.mockReturnValue({ url: "http://a.url" });
        instance.env.analytics.sendReport.mockResolvedValue("test__id");
        await expect(instance.reportError({type: "single", quality: "best", identifier: "test__identifier"})).resolves.toBeTruthy();
        expect(instance.env.analytics.sendReport).toBeCalledTimes(1);
    });
});

describe('raiseError', () => {
   it('does not raise an error if the video type is playlist', () => {
       console.error = jest.fn(() => {});
       const instance = instanceBuilder();
       instance.queryManager.getVideo.mockReturnValue({type: "playlist", identifier: "test__identifier"});
       instance.raiseError(instance.errorDefinitions[1], "test__identifier");
       expect(instance.win.webContents.send).not.toBeCalled();
       expect(instance.queryManager.onError).not.toBeCalled();
   });
   it('sends the error to the renderer process', () => {
       const instance = instanceBuilder();
       instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
       instance.raiseError(instance.errorDefinitions[1], "test__identifier");
       expect(instance.win.webContents.send).toBeCalledTimes(1);
   });
   it('calls onError to mark the video as errored', () => {
       const instance = instanceBuilder();
       instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
       instance.raiseError(instance.errorDefinitions[1], "test__identifier");
       expect(instance.queryManager.onError).toBeCalledWith("test__identifier");
   });
});

describe('raiseUnhandledError', () => {
    it('does not raise an error if the video type is playlist', () => {
        const instance = instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "playlist", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__identifier");
        expect(instance.win.webContents.send).not.toBeCalled();
        expect(instance.queryManager.onError).not.toBeCalled();
    });
    it('adds the error to the unhandled error list', () => {
        const instance = instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__identifier");
        expect(instance.unhandledErrors).toContainEqual({
            identifier: "test__identifier",
            unexpected: true,
            error: {
                code: "Unhandled exception",
                description: "test__unhandled",
            }
        });
    });
    it('sends the error to the renderer process', () => {
        const instance = instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__identifier");
        expect(instance.win.webContents.send).toBeCalledTimes(1);
    });
    it('calls onError to mark the video as errored', () => {
        const instance = instanceBuilder();
        instance.queryManager.getVideo.mockReturnValue({type: "single", identifier: "test__identifier"});
        instance.raiseUnhandledError("test__unhandled", "test__identifier");
        expect(instance.queryManager.onError).toBeCalledWith("test__identifier");
    });
});

describe('checkError', () => {
   it('Raises an error if the message matches a trigger', () => {
       const instance = instanceBuilder();
       instance.raiseError = jest.fn();
       instance.checkError("ERROR: is not a valid URL", "test__identifier");
       expect(instance.raiseError).toBeCalledWith({
           code: "URL not supported",
           description: "This URL is currently not supported by YTDL.",
           trigger: "is not a valid URL"
       }, "test__identifier");
   });
   it('Raises no ffmpeg error when in dev mode', () => {
       process.argv = ["", "", "--dev"]; //Set dev mode enabled
       const instance = instanceBuilder();
       instance.raiseError = jest.fn();
       instance.checkError("ERROR: ffmpeg or avconv not found", "test__identifier");
       expect(instance.raiseError).not.toBeCalled();
   });
   it('Raises an unhandled error if no trigger matches', () => {
       const instance = instanceBuilder();
       instance.raiseError = jest.fn();
       instance.raiseUnhandledError = jest.fn();
       instance.checkError("ERROR: this is some weird kinda error");
       expect(instance.raiseUnhandledError).toBeCalledTimes(1);
       expect(instance.raiseError).not.toBeCalled();
   });
});

function instanceBuilder() {
    const env = {
        analytics: {
            sendReport: jest.fn()
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
    return new ErrorHandler(win, queryManager, env);
}
