const Analytics = require('../modules/Analytics');
const axios = require("axios");
const Utils = require("../modules/Utils");

jest.mock('axios');

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(axios, 'post').mockResolvedValue("");
});

describe('sendDownload', () => {
    it('posts data to the backend when not done already', () => {
        const instance = new Analytics("v2.0.0-test1", null, {statSend: false, save: jest.fn()});
        instance.sendDownload().then(() => {
            expect(axios.post).toBeCalledTimes(1);
        });
    });
    it('does not post data to backend when done already', () => {
        const instance = new Analytics("v2.0.0-test1", null, {statSend: true, save: jest.fn()});
        instance.sendDownload().then(() => {
            expect(axios.post).not.toBeCalled();
        });
    });
    it('updates the statSend setting after sending data', () => {
        const instance = new Analytics("v2.0.0-test1", null, {statSend: false, save: jest.fn()});
        instance.sendDownload().then(() => {
            expect(instance.settings.statSend).toBe(true);
            expect(instance.settings.save).toBeCalledTimes(1);
        });
    });
});

describe('sendReport', () => {
    it('posts data to the backend', () => {
        const instance = new Analytics("v2.0.0-test1", null, {statSend: true, save: jest.fn()});
        instance.sendReport({error: {}}).then(() => {
            expect(axios.post).toBeCalledTimes(1);
        });
    });
    it('returns the report id', () => {
        const testID = "test__id";
        const randomIDSpy = jest.spyOn(Utils, 'getRandomID').mockReturnValueOnce(testID)
        const instance = new Analytics("v2.0.0-test1", null, {statSend: true, save: jest.fn()});
        instance.sendReport({error: {}}).then((data) => {
            expect(data).toBe(testID);
        });
        randomIDSpy.mockRestore();
    });
});
