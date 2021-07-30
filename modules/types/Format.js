class Format {

    constructor(height, fps, filesize, filesize_label) {
        this.height = height;
        this.fps = fps;
        this.filesize = filesize;
        this.filesize_label = filesize_label;
        this.encodings = [];
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
            display_name: this.getDisplayName(),
            encodings: this.encodings
        };
    }

    static deserialize(displayname) {
        return this.getFromDisplayName(displayname);
    }

    static getDisplayName(height, fps) {
        if(fps == null) {
            return height + "p";
        } else {
            return height + "p" + fps;
        }
    }

    static getFromDisplayName(name) {
        let splitName = name.split("p");
        let height = splitName[0];
        let fps = splitName[1];
        if(fps === "") fps = null;
        return new Format(height, fps)
    }
}
module.exports = Format;
