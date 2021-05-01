const Video = require("../modules/types/Video");
const Format = require("../modules/types/Format");

describe('select highest quality', () => {
   it('Sorts the formats high to low', () => {
       const instance = instanceBuilder();
       instance.selectHighestQuality();
       expect(instance.formats[0].height).toEqual("1080");
       expect(instance.formats[0].fps).toEqual("60");
   });
   it('Returns the index of the highest format', () => {
       const instance = instanceBuilder();
       const result = instance.selectHighestQuality();
       expect(result).toBe(0);
   });
});

describe('Get video format from label', () => {
    it('Returns the format matching the label', () => {
        const instance = instanceBuilder();
        Format.prototype.getDisplayName = jest.fn(() => "1080p60");
        const result = instance.getFormatFromLabel("1080p60");
        expect(result).toEqual(instance.formats[0]);
    });
});

describe('Get filename', () => {
   it('Returns undefined when the video has no metadata', () => {
       const instance = instanceBuilder();
       instance.hasMetadata = false;
       const result = instance.getFilename();
       expect(result).toBeFalsy();
   });
   it('Returns only the title with (p) when there are no formats', () => {
       const instance = instanceBuilder();
       instance.hasMetadata = true;
       instance.formats = [];
       instance.title = "test__title";
       const result = instance.getFilename();
       expect(result).toBe("test__title-(p)");
   });
   it('Returns the filename as ytdl outputs it', () => {
       const instance = instanceBuilder();
       instance.hasMetadata = true;
       instance.title = "test__title*";
       instance.selected_format_index = 0;
       const result = instance.getFilename();
       expect(result).toBe("test__title_-(144p12)");
   });
   it('Clips the title length to 200', () => {
       const instance = instanceBuilder();
       instance.hasMetadata = true;
       for(let i=0;i<20;i++) {
           instance.title += "test__title*";
       }
       instance.selected_format_index = 0;
       const result = instance.getFilename();
       expect(result.length).toBeLessThanOrEqual(215);
   })
});

function instanceBuilder(type) {
    const env = {
        paths: {
            downloadPath: "test__downloadpath"
        },
        settings: {
            nameFormatMode: "%(title).200s-(%(height)sp%(fps).0d).%(ext)s"
        }
    };
    const video = new Video("http://test.url", type, env);
    let formats = [];
    const displayNames = ["144p12", "1080p", "480p", "480p30", "480p29", "1080p60"];
    for (const name of displayNames) {
        formats.push(Format.getFromDisplayName(name));
    }
    video.formats = formats;
    return video;
}
