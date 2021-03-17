const UserAgent = require('user-agents');
const Query = require("../modules/types/Query");
const execa = require('execa');
const { PassThrough } = require('stream');

jest.mock('user-agents');
jest.mock('execa');

beforeEach(() => {
    jest.clearAllMocks();
    jest.doMock('execa', () => {
        const originalModule = jest.requireActual('execa')
        return {
            __esModule: true,
            ...originalModule,
            execa: jest.fn()
        }
    });
});

describe('ytdl Query', () => {
    beforeEach(() => {
        execa.mockResolvedValue({stdout: "fake-data"});
    });
    it('adds a random user agent when this setting is enabled', () => {
        UserAgent.prototype.toString = jest.fn().mockReturnValue("agent");
        const errorHandlerMock = jest.fn();
        const instance = instanceBuilder(true, null, errorHandlerMock);
        return instance.start("https://url.link", [], null).then(() => {
            expect(UserAgent.prototype.toString).toBeCalledTimes(1);
            expect(execa.mock.calls[0][1]).toContain("--user-agent");
            expect(execa.mock.calls[0][1]).toContain("agent");
        });
    });
   it('adds the cookies argument when specified in settings', () => {
        const errorHandlerMock = jest.fn();
        const instance = instanceBuilder(false, "a/path/to/cookies.txt", errorHandlerMock);
        return instance.start("https://url.link", [], null).then(() => {
            expect(execa.mock.calls[0][1]).toContain("--cookies");
            expect(execa.mock.calls[0][1]).toContain("a/path/to/cookies.txt");
        });
    });
    it('adds the url as final argument', () => {
        const errorHandlerMock = jest.fn();
        const instance = instanceBuilder(false, null, errorHandlerMock);
        return instance.start("https://url.link", [], null).then(() => {
            expect(execa.mock.calls[0][1]).toContain("https://url.link");
        });
    })
    it('adds the no-cache-dir as argument', () => {
        const errorHandlerMock = jest.fn();
        const instance = instanceBuilder(false, null, errorHandlerMock);
        return instance.start("https://url.link", [], null).then(() => {
            expect(execa.mock.calls[0][1]).toContain("--no-cache-dir");
        });
    });
})

describe('Query with live callback', () => {
    it('Stops with return value killed when stop() is called', async () => {
        const [stdout, stderr, mock] = execaMockBuilder(true);
        execa.mockReturnValue(mock)
        const errorHandlerMock = jest.fn();
        const callbackMock = jest.fn();
        const instance = instanceBuilder(false, null, errorHandlerMock);
        const result = instance.start("https://url.link", [], callbackMock);
        setTimeout(() => {
            instance.stop();
        }, 100);
        await expect(result).resolves.toEqual("killed");
        expect(callbackMock).toBeCalledWith("killed");
    });
    it('Checks the error when stderr gets written to', async () => {
        const [stdout, stderr, mock] = execaMockBuilder(false);
        execa.mockReturnValue(mock)
        console.error = jest.fn();
        const errorHandlerMock = jest.fn();
        const callbackMock = jest.fn();
        const instance = instanceBuilder(false, null, errorHandlerMock);
        const result = instance.start("https://url.link", [], callbackMock);
        setTimeout(() => {
            stderr.emit("data", "test-error");
        }, 100);
        setTimeout(() => {
            stdout.emit("close");
        }, 100);
        await result;
        expect(errorHandlerMock).toBeCalledWith("test-error", "test__id");
    });
    it('Resolves "done" when query was successful', async () => {
        const [stdout, stderr, mock] = execaMockBuilder(false);
        execa.mockReturnValue(mock)
        const callbackMock = jest.fn();
        const instance = instanceBuilder(false, null, jest.fn());
        const result = instance.start("https://url.link", [], callbackMock);
        setTimeout(() => {
            stdout.emit("close");
        }, 100);
        await expect(result).resolves.toEqual("done");
        expect(callbackMock).toBeCalledWith("done");
    });
    it('Sends live stdout to the callback', async () => {
        const [stdout, stderr, mock] = execaMockBuilder(false);
        execa.mockReturnValue(mock);
        const callbackMock = jest.fn();
        const instance = instanceBuilder(false, null, jest.fn());
        const result = instance.start("https://url.link", [], callbackMock);
        setTimeout(() => {
            stdout.emit("data", "test-data");
            stdout.emit("data", "more-test-data");
            stdout.emit("close");
        }, 100);
        await result;
        expect(callbackMock).toBeCalledWith("test-data");
        expect(callbackMock).toBeCalledWith("more-test-data");
    });
});

describe('Query without callback', () => {
    it('Returns the data from the execa call', async () => {
        execa.mockResolvedValue({stdout: "fake-data"});
        const errorHandlerMock = jest.fn();
        const instance = instanceBuilder(true, null, errorHandlerMock);
        const result = instance.start("https://url.link", [], null)
        await expect(result).resolves.toEqual("fake-data");
    });
    it('Returns a stringified empty object on error', async () => {
        execa.mockResolvedValue(null);
        const errorHandlerMock = jest.fn();
        const instance = instanceBuilder(true, null, errorHandlerMock);
        const result = instance.start("https://url.link", [], null)
        await expect(result).resolves.toEqual("{}");
    });
    it('Checks the error on error', () => {
        execa.mockResolvedValue(null);
        const errorHandlerMock = jest.fn();
        const instance = instanceBuilder(true, null, errorHandlerMock);
        return instance.start("https://url.link", [], null).then(() => {
            expect(errorHandlerMock).toBeCalledTimes(1);
        });
    });
})

function execaMockBuilder(killed) {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const mock = {stdout: stdout, stderr: stderr, cancel: jest.fn(() => { stdout.emit("close") }), killed: killed}
    return [stdout, stderr, mock];
}

function instanceBuilder(spoofUserAgent, cookiePath, errorHandlerMock) {
    return new Query({errorHandler: {checkError: errorHandlerMock}, paths: {ytdl: "a/path/to/ytdl"}, settings: {cookiePath: cookiePath, spoofUserAgent: spoofUserAgent}}, "test__id");
}
