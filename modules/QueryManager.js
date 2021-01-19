const InfoQuery = require("./info/InfoQuery");
const Video = require("./types/Video");
const Utils = require("./Utils");
const InfoQueryList = require("./info/InfoQueryList");
const SizeQueryList = require("./info/SizeQueryList");
const QueryList = require("./info/QueryList");
const ProgressBar = require("./types/ProgressBar");

class QueryManager {

    //TODO ADD SIZE QUERY TO CALCULATE SIZE ACCORDING TO SETTINGS
    //TODO Fully async size query and show spinner

    constructor(window, environment) {
        this.window = window;
        this.environment = environment;
    }

    async manage(url) {
        let metadataVideo = new Video(url, "metadata", this.environment);
        this.addVideo(metadataVideo);
        const initialQuery = await new InfoQuery(url, this.environment).connect();
        this.removeVideo(metadataVideo.identifier);

        switch(Utils.detectInfoType(initialQuery)) {
            case "single":
                this.manageSingle(initialQuery, url);
                break;
            case "playlist":
                this.managePlaylist(initialQuery, url)
                break;
        }
    }

    manageSingle(initialQuery, url) {
        console.log("manageSingle")
        let video = new Video(url, "single", this.environment);
        video.setMetadata(initialQuery);
        this.addVideo(video);
    }

    managePlaylist(initialQuery, url) {
        console.log("manageList");
        let playlistVideo = new Video(url, "playlist", this.environment);
        this.addVideo(playlistVideo);
        const playlistQuery = new InfoQueryList(initialQuery, this.environment, new ProgressBar(this, playlistVideo));
        playlistQuery.start().then((videos) => {
            this.removeVideo(playlistVideo.identifier);
            for(const video of videos) {
                this.addVideo(video);
            }
        });
    }

    addVideo(video) {
        let formats = [];
        if(video.hasMetadata) {
            for(const format of video.formats) {
                formats.push(format.serialize());
            }
        }
        let args = {
            action: "add",
            type: video.type,
            identifier:  video.identifier,
            url: video.url,
            title: video.title,
            duration: video.duration,
            formats: formats,
            selected_format_index: (video.hasMetadata) ? video.selected_format_index : null,
            thumbnail: video.thumbnail
        }
        console.log("sending")
        console.log(args)
        this.window.webContents.send("videoAction", args);
    }

    updateVideo(video) {

    }

    removeVideo(identifier) {
        this.window.webContents.send("videoAction", { action: "remove", identifier: identifier })
    }

    updateProgress(video, percent, done, total) {
        let args = {
            action: "progress",
            identifier: video.identifier,
            percentage: percent,
            done: done,
            total: total
        }
        this.window.webContents.send("videoAction", args);
    }

}
module.exports = QueryManager;
