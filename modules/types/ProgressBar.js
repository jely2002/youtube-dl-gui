class ProgressBar {
    constructor(manager, video) {
        this.manager = manager;
        this.video = video;
    }

    updatePlaylist(done, total) {
        let percent = ((done / total) * 100).toFixed(2) + "%";
        this.manager.updateProgress(this.video, {percentage: percent, done: done, total: total});
    }

    updateDownload(percentage, eta, speed, isAudio) {
        this.manager.updateProgress(this.video, {percentage: percentage, eta: eta, speed: speed, isAudio: isAudio});
    }

    reset() {
        this.manager.updateProgress(this.video, {reset: true})
    }

    done(isAudio) {
        this.manager.updateProgress(this.video, {finished: true, isAudio: isAudio})
    }
}
module.exports = ProgressBar;
