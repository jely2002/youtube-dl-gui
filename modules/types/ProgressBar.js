class ProgressBar {
    constructor(manager, video) {
        this.manager = manager;
        this.video = video;
    }

    updatePlaylist(done, total) {
        if(done === 0 && total === 0) {
            this.manager.updateProgress(this.video, {resetTotal: true})
        } else {
            let percent = ((done / total) * 100).toFixed(2) + "%";
            this.manager.updateProgress(this.video, {
                percentage: percent,
                done: done,
                total: total,
                isPlaylist: this.isUnifiedPlaylist()
            });
        }
    }

    updateDownload(percentage, eta, speed, isAudio) {
        this.manager.updateProgress(this.video, {percentage: percentage, eta: eta, speed: speed, isAudio: this.video.formats.length === 0 ? null : isAudio});
    }

    reset() {
        this.manager.updateProgress(this.video, {reset: true})
    }

    setInitial(message) {
        this.manager.updateProgress(this.video, {initial: true, message: message});
    }

    done(isAudio) {
        let audio = isAudio;
        if(!this.isUnifiedPlaylist()) audio = this.video.formats.length === 0 ? null : isAudio;
        this.manager.updateProgress(this.video, {finished: true, isAudio: audio, isPlaylist: this.isUnifiedPlaylist()})
    }

    isUnifiedPlaylist() {
        if(typeof this.video === "string") {
            return true;
        } else {
            return this.video.videos != null;
        }
    }
}
module.exports = ProgressBar;
