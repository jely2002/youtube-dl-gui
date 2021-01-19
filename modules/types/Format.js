class Format {
    //audioQuality = best | worst
    constructor(height, fps, filesize, filesize_label) {
        this.height = height;
        this.fps = fps;
        this.filesize = filesize;
        this.filesize_label = filesize_label;
    }

    getDisplayName() {
        if(this.fps == null) {
            return this.height + "p";
        } else {
            return this.height + "p" + this.fps;
        }
    }

    serialize() {
        return {
            height: this.height,
            fps: this.fps,
            filesize: this.filesize,
            filesize_label: this.filesize_label,
            display_name: this.getDisplayName()
        };
    }

    static deserialize(format) {
        return new Format(format.height, format.fps, format.filesize, format.filesize_label);
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
