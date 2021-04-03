const execa = require('execa');
const DetectPython = require("../modules/DetectPython");

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

describe('test', () => {
   it('returns true when successful', () => {
       const instance = new DetectPython();
       execa.mockResolvedValue("test output");
       expect(instance.test()).resolves.toBeTruthy();
   });
   it('returns false on error', () => {
       const instance = new DetectPython();
       execa.mockImplementation(() => {
           throw new Error("ENOENT");
       });
       expect(instance.test()).resolves.toBeFalsy();
   });
});

describe('detect', () => {
   it("Returns python if all tests fail", () => {
       const instance = new DetectPython();
       jest.spyOn(instance, 'test').mockResolvedValue(false);
       expect(instance.detect()).resolves.toEqual("python");
   });
   it("Returns the command of the first completed test", async () => {
       const commands = ["python", "python3", "python2"];
       for(const command of commands) {
           const instance = new DetectPython();
           jest.spyOn(instance, 'test').mockImplementation((cmd) => {
               return cmd === command;
           })
           const result = await instance.detect();
           expect(result).toEqual(command);
       }
   });
});
