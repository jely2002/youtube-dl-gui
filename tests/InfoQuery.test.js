const InfoQuery = require("../modules/info/InfoQuery");

describe('Connect the InfoQuery', () => {
    beforeEach(() => {
       jest.clearAllMocks();
    });
    it('Checks the error when applicable', async () => {
        const [env, instance] = instanceBuilder();
        env.metadataLimiter.schedule.mockRejectedValue({ stderr: "test-error"});
        const result = instance.connect();
        await result;
        expect(env.errorHandler.checkError).toBeCalledWith("test-error", "test__id");
    });
    it('Returns null on error', async () => {
        const [env, instance] = instanceBuilder();
        env.metadataLimiter.schedule.mockRejectedValue({ stderr: "test-error"});
        const result = instance.connect();
        await expect(result).resolves.toBe(null);
    });
    it('Schedules the query', async () => {
        const [env, instance] = instanceBuilder();
        const jsonString = "{\"test\": \"data\"}";
        env.metadataLimiter.schedule.mockResolvedValue(jsonString);
        const result = instance.connect();
        await result;
        expect(env.metadataLimiter.schedule).toBeCalledTimes(1);
    });
    it('Returns the parsed query data', async () => {
        const [env, instance] = instanceBuilder();
        const jsonString = "{\"test\": \"data\"}";
        env.metadataLimiter.schedule.mockResolvedValue(jsonString);
        const result = instance.connect();
        await expect(result).resolves.toMatchObject(JSON.parse(jsonString))
    });
});

function instanceBuilder() {
    const env = {
        metadataLimiter: {
            schedule: jest.fn()
        },
        errorHandler: {
            checkError: jest.fn()
        }
    };
    return [env, new InfoQuery("http://url.link", "test__id", env)];
}

