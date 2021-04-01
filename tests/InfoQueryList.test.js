const InfoQueryList = require("../modules/info/InfoQueryList");
const video = require('../modules/types/Video');

describe("create video", () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });
   it('returns a video', () => {
      const instance = instanceBuilder();
      jest.spyOn(video.prototype, 'setMetadata').mockImplementation(() => {});
      const result = instance.createVideo({test: "data"}, "https://test.url");
      expect(result).toBeInstanceOf(video);
   });
   it('sets the metadata', () => {
      const instance = instanceBuilder();
      const metadataSpy = jest.spyOn(video.prototype, 'setMetadata').mockImplementation(() => {});
      instance.createVideo({test: "data"}, "https://test.url");
      expect(metadataSpy).toBeCalledTimes(1);
   });
   it('uses data.entries[0] when appropriate', () => {
      const instance = instanceBuilder();
      const metadataSpy = jest.spyOn(video.prototype, 'setMetadata').mockImplementation(() => {});
      instance.createVideo({entries: [{formats: "insert_formats_here"}]}, "https://test.url");
      expect(metadataSpy).toBeCalledWith({formats: "insert_formats_here"});
   });
});

function instanceBuilder() {
   const progressbar = {
      video: { identifier: "test__id" },
      updatePlaylist: jest.fn()
   }
   return new InfoQueryList("test__query", "test__env", progressbar);
}
