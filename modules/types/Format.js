class Format {
    //audioQuality = best | worst
    constructor(height, fps) {
        this.height = height;
        this.fps = fps;
        this.filesize = null;
        this.filesize_label = null;
    }

    getDisplayName() {
        if(this.fps == null) {
            return this.height + "p";
        } else {
            return this.height + "p" + this.fps;
        }
    }

    static getFromDisplayName(name) {
        let splitName = name.split("p");
        let height = splitName[0];
        let fps = splitName[1];
        if(fps === "") fps = null;
        return new Format(height, fps, null)
    }
}
module.exports = Format;
