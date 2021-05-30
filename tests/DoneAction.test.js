const execa = require('execa');
const DoneAction = require("../modules/DoneAction");

jest.mock('execa');

const platforms = ["win32", "linux", "darwin"];
const actions = ["Lock", "Sleep", "Shutdown"];
const actionLength = [4, 3, 3];

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

describe('execute', () => {
    it('executes the chosen action', () => {
        for(const platform of platforms) {
            Object.defineProperty(process, "platform", {
                value: platform
            });
            const instance = new DoneAction();
            execa.mockResolvedValue("");
            instance.executeAction(actions[platforms.indexOf(platform)]);
            expect(execa.mock.calls[platforms.indexOf(platform)]).toBeTruthy();
        }
        expect(execa).toBeCalledTimes(platforms.length);
    });
    it('does nothing on Do nothing', () => {
        const instance = new DoneAction();
        execa.mockResolvedValue("");
        instance.executeAction("Do nothing");
        expect(execa).toBeCalledTimes(0);
    });
    it('exits on Close app', () => {
        const instance = new DoneAction();
        execa.mockResolvedValue("");
        process.exit = jest.fn();
        instance.executeAction("Close app");
        expect(process.exit).toBeCalledTimes(1);
    });
    it('logs an error', async () => {
        const instance = new DoneAction();
        execa.mockRejectedValue("");
        console.error = jest.fn().mockImplementation(() => {});
        await instance.executeAction("Sleep");
        expect(console.error).toBeCalledTimes(1);
    });
});

describe('get', () => {
    it("Returns the actions for the platform", () => {
        for(const platform of platforms) {
            Object.defineProperty(process, "platform", {
                value: platform
            });
            const instance = new DoneAction();
            const actions = instance.getActions();
            expect(actions.length).toEqual(actionLength[platforms.indexOf(platform)]);
        }
    });
});
