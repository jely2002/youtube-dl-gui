const Format = require("../modules/types/Format");

describe('Get display name from format', () => {
    it('gets the display name with fps', () => {
        const format = new Format(1080, 59, null, null);
        expect(format.getDisplayName()).toBe("1080p59");
    });
    it('gets the display name without fps', () => {
        const format = new Format(3260, null, null, null);
        expect(format.getDisplayName()).toBe("3260p");
    });
});

describe('get display name from parameters', () => {
   it('gets the display name with fps', () => {
      expect(Format.getDisplayName(1080, 60)).toBe("1080p60");
   });
    it('gets the display name without fps', () => {
        expect(Format.getDisplayName(1080, null)).toBe("1080p");
    });
});

describe("Get format from display name", () => {
    it('returns a format with fps', () => {
        expect(Format.getFromDisplayName("1080p60")).toEqual(new Format("1080", "60"))
    });
    it('returns a format without fps', () => {
        expect(Format.getFromDisplayName("720p")).toEqual(new Format("720", null))
    });
});

describe('Serialization', () => {
   it('returns a serialized object', () => {
       const format = new Format(1440, 30, 999, "400 MB");
       expect(format.serialize()).toEqual({
           height: 1440,
           fps: 30,
           filesize: 999,
           encodings: [],
           filesize_label: "400 MB",
           display_name: "1440p30"
       });
   })
   it('adds the display name to the serialized object', () => {
       const format = new Format(1440, 30, 999, "400 MB");
       const getDisplayNameSpy = jest.spyOn(format, 'getDisplayName');
       format.serialize();
       expect(getDisplayNameSpy).toBeCalledTimes(1);
   });
});

describe('Deserialization', () => {
    it('returns a format', () => {
        expect(Format.deserialize("1080p60")).toBeInstanceOf(Format);
    });
    it('is a wrapper function for getFromDisplayName', () => {
       const getFromDisplayNameSpy = jest.spyOn(Format, 'getFromDisplayName');
       Format.deserialize("1080p60");
       expect(getFromDisplayNameSpy).toBeCalledTimes(1);
    });
});

