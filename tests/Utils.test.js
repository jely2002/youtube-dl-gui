const Utils = require("../modules/Utils");

describe('isYouTubeChannel', () => {
    it('detects a user link', () => {
        expect(Utils.isYouTubeChannel("https://www.youtube.com/user/NoCopyrightSounds")).toBe(true);
    });
    it('detects a channel link', () => {
        expect(Utils.isYouTubeChannel("https://www.youtube.com/channel/UCJ0BmJOn_bRKiApjc45QZ1w")).toBe(true);
    });
    it('does not detect a video link', () => {
        expect(Utils.isYouTubeChannel("https://www.youtube.com/watch?v=K4DyBUG242c")).toBe(false);
    });
});

describe('getRandomID', () => {
    it('generates an id', () => {
        expect(Utils.getRandomID(128)).toBeTruthy();
    })
    it('generates a unique id', () => {
        const testLength = 128;
        const test1 = Utils.getRandomID(testLength);
        const test2 = Utils.getRandomID(testLength);
        expect(test1).not.toEqual(test2);
    })
    it('generates an id of the right length', () => {
        expect(Utils.getRandomID(128).length).toBe(128);
    })
});

describe('dedupeSubtitles', () => {
    it('dedupes by name', () => {
        const testList = [ {name: "dutch", iso: "nl"}, {name: "dutch", iso: "nl"}, {name: "english", iso: "en"} ];
        const testListDeduped = [ {name: "dutch", iso: "nl"}, {name: "english", iso: "en"} ];
        expect(Utils.dedupeSubtitles(testList)).toEqual(testListDeduped);
    })
});

describe('sortSubtitles', () => {
    const testList = [{name: "finland", iso: "fi"}, {name: "english", iso: "en"}, {name: "afrikaans", iso: "af"}, {name: "afrikaans", iso: "af"},  {name: "belgium", iso: "be"}, {name: "dutch", iso: "nl"}  ];
    const testListSorted = [ {name: "afrikaans", iso: "af"}, {name: "afrikaans", iso: "af"}, {name: "belgium", iso: "be"}, {name: "dutch", iso: "nl"}, {name: "english", iso: "en"}, {name: "finland", iso: "fi"} ];
    expect(testList.sort(Utils.sortSubtitles)).toEqual(testListSorted);
});

describe('getIsoFromName', () => {
    const isoNames = require('./iso-test.json');
    for(const isoName of isoNames) {
        expect(Utils.getNameFromISO(isoName.iso)).toBe(isoName.name);
    }
})


describe('convertBytes', () => {
    it('returns a defined value', () => {
        expect(Utils.convertBytesPerSecond(50)).toBeTruthy();
    });
    it('returns a parsed representation of bytes', () => {
        const bytesToTest = [15, 568, 9999, 16094, 2956247, 6506291274, 5728194672913];
        const expectedOutput = ["15 bytes", "568 bytes", "9.8 KB", "16 KB", "2.8 MB", "6.1 GB", "5.2 TB"]
        for (const [i, bytes] of bytesToTest.entries()) {
            expect(Utils.convertBytes(bytes)).toBe(expectedOutput[i])
        }
    });
});

describe('convertBytesPerSecond', () => {
    it('returns a defined value', () => {
       expect(Utils.convertBytesPerSecond(50)).toBeTruthy();
    });
    it('returns a parsed representation of bytes per second', () => {
        const bytesToTest = [15, 568, 9999, 16094, 2956247, 6506291274, 5728194672913];
        const expectedOutput = ["15 B/s", "568 B/s", "9.8 KB/s", "16 KB/s", "2.8 MB/s", "6.1 GB/s", "5.2 TB/s"]
        for (const [i, bytes] of bytesToTest.entries()) {
            expect(Utils.convertBytesPerSecond(bytes)).toBe(expectedOutput[i])
        }
    });
});

describe('numberFormatter', () => {
    it('returns a defined value', () => {
       expect(Utils.numberFormatter(50)).toBeTruthy();
    });
    it('returns formatted numbers', () => {
        const numbersToTest = [52, 4572, 27001, 6923500, 3917421562];
        const expectedOutput = ["52", "4.57K", "27K", "6.92M", "3.92B"];
        for (const [i, number] of numbersToTest.entries()) {
            expect(Utils.numberFormatter(number, 2)).toBe(expectedOutput[i])
        }
    });
});

describe('extractPlaylistUrls', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.error = jest.fn().mockImplementation(() => {});
    });
   it('returns empty array when playlist has no entries', () => {
       expect(Utils.extractPlaylistUrls({})).toEqual([[], []]);
       expect(console.error).toBeCalledTimes(1);
   });
   it('returns playlist urls',() => {
       expect(Utils.extractPlaylistUrls({entries: [{url: "1"}, {url: "2"}]})).toContainEqual(["1", "2"])
   });
   it('returns already done (queried) urls', () => {
       expect(Utils.extractPlaylistUrls({entries: [{url: "1", formats: ["format"]}, {url: "2"}]})).toContainEqual([{url: "1", formats: ["format"]}]);
   });
   it('uses the webpage_url when url is null', () => {
      expect(Utils.extractPlaylistUrls({entries: [{webpage_url: "url"}]})).toContainEqual(["url"]);
   });
   it('generates a youtube link when only the id is available', () => {
      expect(Utils.extractPlaylistUrls({entries: [{ie_key: "Youtube", url: "K4DyBUG242c"}]})).toContainEqual(["https://youtube.com/watch?v=K4DyBUG242c"]);
      expect(Utils.extractPlaylistUrls({entries: [{ie_key: "Vimeo", url: "K4DyBUG242c"}]})).not.toContainEqual(["https://youtube.com/watch?v=K4DyBUG242c"]);
   });
});

describe('detectInfoType', () => {
   it('returns the object when parameter is empty', () => {
       expect(Utils.detectInfoType(null)).toBe(null);
       expect(Utils.detectInfoType([])).toEqual([]);
       expect(Utils.detectInfoType({})).toEqual({});
   });
   it('returns livestream when is_live is true', () => {
       expect(Utils.detectInfoType({_type: "video", is_live: true})).toBe("livestream");
       expect(Utils.detectInfoType({_type: null})).not.toBe("livestream");
   });
   it('returns playlist when the type is playlist', () => {
       expect(Utils.detectInfoType({_type: "playlist"})).toBe("playlist");
       expect(Utils.detectInfoType({_type: null})).not.toBe("playlist");
   });
    it('returns playlist when there are entries', () => {
        expect(Utils.detectInfoType({_type: null, entries: new Array(10)})).toBe("playlist");
        expect(Utils.detectInfoType({_type: null, entries: null})).not.toBe("playlist");
    });
    it('returns single when playlist is not detected', () => {
       expect(Utils.detectInfoType({_type: null, entries: null})).toBe("single");
       expect(Utils.detectInfoType({_type: null, entries: new Array(10)})).not.toBe("single");
       expect(Utils.detectInfoType({_type: "playlist"})).not.toBe("single");
    });
});

describe('hasFilesizes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.error = jest.fn().mockImplementation(() => {});
    });
    it('returns false when no formats available', () => {
        expect(Utils.hasFilesizes({formats: null})).toBe(false);
    });
    it('returns true when filesizes are found', () => {
        expect(Utils.hasFilesizes({formats: [{filesize: "size"}, {filesize: null}]})).toBe(true);
    });
    it('returns false when no filesizes are found', () => {
        expect(Utils.hasFilesizes({formats: [{filesize: null}, {filesize: null}]})).toBe(false);
    });
})

describe("parseAvailableFormats", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.error = jest.fn().mockImplementation(() => {});
    });
    it('returns empty array when no formats available', () => {
        expect(Utils.parseAvailableFormats({formats: null})).toEqual([]);
    });
    it('returns a list of formats', () => {
       const output = Utils.parseAvailableFormats({formats: [{height: 1080, fps: 60}, {height: 720, fps: 30}]});
        for(const el of output) {
            expect(el).toBeTruthy();
            expect(el.height).toBeTruthy();
            expect(el.fps).toBeTruthy();
        }
    });
    it('adds no duplicates to the format list', () => {
        const output = Utils.parseAvailableFormats({formats: [{height: 1080, fps: 60}, {height: 1080, fps: 60}, {height: 1080, fps: 30}]});
        const uniqueValues = [...new Set(output.map(a => a.height + a.fps))];
        expect(uniqueValues.length === output.length).toBeTruthy();
    });
    it('adds no formats with no height to the list', () => {
        const output = Utils.parseAvailableFormats({formats: [{height: null, fps: 60}, {height: 1080, fps: 60}]});
        for(const el of output) {
            expect(el.height).toBeTruthy();
        }
    });
})


