const Analytics = require('../modules/Analytics');
const Utils = require("../modules/Utils");
const dotenv = require("dotenv");
const Sentry = require("@sentry/electron");
const path = require("path");

jest.mock('dotenv');

jest.mock('@sentry/electron', () => ({
    init: jest.fn()
}));

beforeEach(() => {
    jest.clearAllMocks();
});


describe('init sentry', () => {
   it("loads dotenv with packaged path", () => {
       const dotenvMock = jest.spyOn(dotenv, 'config').mockImplementation(() => {});
       const instance = instanceBuiler(true);
       instance.app.getAppPath = jest.fn(() => "app/path");
       instance.initSentry();
       expect(dotenvMock).toBeCalledTimes(1);
   });
    it("loads dotenv with test path", () => {
        const dotenvMock = jest.spyOn(dotenv, 'config').mockImplementation(() => {});
        const instance = instanceBuiler(false);
        instance.app.getAppPath = jest.fn(() => "app/path");
        instance.initSentry();
        expect(dotenvMock).toBeCalledTimes(1);
    });
   it("inits sentry in dev mode", () => {
       process.argv = ["", "", "--dev"];
       jest.spyOn(dotenv, 'config').mockImplementation(() => {});
       const instance = instanceBuiler();
       instance.initSentry();
       expect(Sentry.init).toBeCalledTimes(1);
       expect(Sentry.init.mock.calls[0][0].environment).toBe("development");
   });
    it("inits sentry in prod mode", () => {
        process.argv = ["", ""];
        jest.spyOn(dotenv, 'config').mockImplementation(() => {});
        const instance = instanceBuiler();
        instance.initSentry();
        expect(Sentry.init).toBeCalledTimes(1);
        expect(Sentry.init.mock.calls[0][0].environment).toBe("production");
    });
});

describe('sendReport', () => {
    it('returns the report id', () => {
        const testID = "test__id";
        const randomIDSpy = jest.spyOn(Utils, 'getRandomID').mockReturnValueOnce(testID)
        const instance = new Analytics();
        instance.sendReport(testID).then((data) => {
            expect(data).toBe(testID);
        });
        randomIDSpy.mockRestore();
    });
});

function instanceBuiler(packaged) {
    const app = { isPackaged: packaged, getVersion: jest.fn()}
    return new Analytics(app);
}
