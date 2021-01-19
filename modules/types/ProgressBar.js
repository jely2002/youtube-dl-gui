class ProgressBar {
    constructor(manager, video) {
        this.manager = manager;
        this.video = video;
    }

    update(percent, done, total) {
        this.manager.updateProgress(this.video, percent, done, total);
    }
}
module.exports = ProgressBar;
