const ClipboardWatcher = require("../modules/ClipboardWatcher");
const { clipboard } = require('electron');


jest.mock('electron', () => ({
    clipboard: {
        readText: jest.fn()
    }
}));

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
});

describe('poll', () => {
    it('reads the text from the clipboard', () => {
        clipboard.readText.mockReturnValue("https://i.am.a.url.com");
        const instance = instanceBuilder(true);
        const resetMock = jest.spyOn(instance, "resetPlaceholder").mockImplementation(() => {});
        instance.poll();
        expect(clipboard.readText).toBeCalledTimes(1);
        expect(resetMock).toBeCalledTimes(0);
    });
    it('resets when it is not a URL', () => {
        clipboard.readText.mockReturnValue("im not a url");
        const instance = instanceBuilder(true);
        const resetMock = jest.spyOn(instance, "resetPlaceholder").mockImplementation(() => {});
        instance.poll();
        expect(resetMock).toBeCalledTimes(1);
    });
    it('resets when the copied text is null', () => {
        clipboard.readText.mockReturnValue(null);
        const instance = instanceBuilder(true);
        const resetMock = jest.spyOn(instance, "resetPlaceholder").mockImplementation(() => {});
        instance.poll();
        expect(resetMock).toBeCalledTimes(1);
    });
    it('sends the URL to renderer if it is one', () => {
        clipboard.readText.mockReturnValue("https://i.am.a.url.com");
        const instance = instanceBuilder(true);
        const resetMock = jest.spyOn(instance, "resetPlaceholder").mockImplementation(() => {});
        instance.poll();
        expect(instance.win.webContents.send).toBeCalledWith("updateLinkPlaceholder", {text: "https://i.am.a.url.com", copied: true})
        expect(instance.win.webContents.send).toBeCalledTimes(1);
        expect(resetMock).toBeCalledTimes(0);
    });
    it('doesnt poll when it is disabled in settings', () => {
        clipboard.readText.mockReturnValue("https://i.am.a.url.com");
        const instance = instanceBuilder(false);
        const resetMock = jest.spyOn(instance, "resetPlaceholder").mockImplementation(() => {});
        instance.poll();
        expect(clipboard.readText).toBeCalledTimes(0);
        expect(resetMock).toBeCalledTimes(0);
        expect(instance.win.webContents.send).toBeCalledTimes(0);
    });
    it('does nothing when the previous copied text matches the new one', () => {
        clipboard.readText.mockReturnValue("https://i.am.a.url.com");
        const instance = instanceBuilder(true);
        const resetMock = jest.spyOn(instance, "resetPlaceholder").mockImplementation(() => {});
        instance.poll();
        instance.poll();
        expect(clipboard.readText).toBeCalledTimes(2);
        expect(resetMock).toBeCalledTimes(0);
        expect(instance.win.webContents.send).toBeCalledTimes(1);
    });
});

describe('resetPlaceholder', () => {
    it('sends the standard placeholder to renderer', () => {
        const instance = instanceBuilder(true);
        instance.resetPlaceholder();
        expect(instance.win.webContents.send).toBeCalledTimes(1);
        expect(instance.win.webContents.send.mock.calls[0][1].copied).toBeFalsy();
    });
});

describe('startPolling', () => {
   it('Polls one time', () => {
       const instance = instanceBuilder(true);
       const pollMock = jest.spyOn(instance, "poll").mockImplementation(() => {});
       instance.startPolling()
       expect(pollMock).toBeCalledTimes(1);
   });
   it('Starts a polling loop', () => {
       const loops = 5;
       const instance = instanceBuilder(true);
       const pollMock = jest.spyOn(instance, "poll").mockImplementation(() => {});
       instance.startPolling()
       jest.advanceTimersByTime(loops * 1000);
       expect(pollMock).toBeCalledTimes(loops + 1);
   });
});

function instanceBuilder(enabled) {
    const env = {settings: {autoFillClipboard: enabled}};
    const win = {webContents: {send: jest.fn()}};
    return new ClipboardWatcher(win, env);
}
