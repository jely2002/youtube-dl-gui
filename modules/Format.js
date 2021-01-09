class Format {
    //audio = best | worst
    constructor(height, fps, audioQuality, audioOnly) {
        this.height = height;
        this.fps = fps;
        this.audioQuality = audioQuality;
        this.audioOnly = audioOnly;
    }

    getDisplayName() {
        if (this.audioOnly) {
            return this.audioQuality;
        } else {
            return this.height + "p" + this.fps;
        }
    }

    static getFromDisplayName(name, audio) {
        let splitName = name.split("p");
        let height = splitName[0];
        let fps = splitName[1];
        if(audio == null) audio = "best";
        return new Format(height, fps, audio)
    }
}
module.exports = Format;
