let platform;
let linkCopied = false;
let progressCooldown = [];
let sizeCooldown = [];
let sizeCache = [];
let logUpdateTask;

(function () { init(); })();

async function init() {
    //Get platform
    platform = await window.main.invoke('platform');

    //Initialize titlebar
    if(platform === "darwin") {
        new window.windowbar({'style':'mac', 'dblClickable':false, 'fixed':true, 'title':document.title,'dark':true})
            .appendTo(document.body)
        $('.windowbar-title').css("left", "50%").css("top", "14px");
        $('.windowbar-controls').css("display", "none");
    } else {
        new window.windowbar({'style':'win', 'dblClickable':false, 'fixed':true, 'title':document.title,'dark':true})
            .appendTo(document.body)
        $('.windowbar').prepend("<img src='img/icon-titlebar-dark.png' alt='icon' class='windowbar-icon'>")
        $('.windowbar-title').css("left", "45px")
    }
    $('.windowbar-minimize').on('click', () => {
        window.main.invoke('titlebarClick', "minimize")
    })
    $('.windowbar-close').on('click', () => {
        window.main.invoke('titlebarClick', "close")
    })
    $('.windowbar-maximize').on('click', () => {
        window.main.invoke('titlebarClick', "maximize")
    })

    //Updates the placeholder to a copied link
    window.main.receive("updateLinkPlaceholder", (args) => {
        $('#add-url').prop("placeholder", args.text);
        linkCopied = args.copied;
    });

    //Verify the url when the addShortcut gets used
    window.main.receive("addShortcut", (link) => {
        verifyURL(link);
    })

    window.main.receive("downloadShortcut", () => {
        $('#downloadBtn').click();
    })

    //Init draggable cards
    const dragArea = document.querySelector(".video-cards");
    new Sortable(dragArea, {
        animation: 200,
        sort: true,
        draggable: ".video-card",
        handle: ".handle"
    });

    //Init the when done dropdown
    $('.dropdown-toggle').dropdown();
    const availableOptions = await window.main.invoke('getDoneActions');
    for(const option of availableOptions) {
        $('#whenDoneOptions').append('<li class="dropdown-divider"></li>').append(`<li><a class="dropdown-item" href="#">${option}</a></li>`)
    }
    $('.dropdown-item').on('click', function() {
        $('#whenDoneOptions').find('.dropdown-selected').removeClass('dropdown-selected');
        $(this).addClass('dropdown-selected');
        window.main.invoke("setDoneAction", {action: $(this).text()});
    })

    //Set the selected theme (dark | light)
    const startupTheme = await window.main.invoke('theme');
    toggleWhiteMode(startupTheme);

    $('.video-cards').each(function() {
        let sel = this;
        new MutationObserver(function() {
            //If the queue is completely empty show the empty text
            if ($('.video-cards').is(':empty')) {
                $('.empty').show();
                resetTotalProgress();
                $('#downloadBtn, #clearBtn').prop("disabled", true);
                updateGlobalDownloadQuality();
            } else {
                $('.empty').hide();
            }

        }).observe(sel, {childList: true, subtree: true});
    });

    //Configures the update toast
    $('#update').toast({
        autohide: false,
        animation: true
    })

    //Configures the restore toast
    $('#task-list').toast({
        autohide: false,
        animation: true
    })

    //Initialize select2
    $("#subsLang").select2({width: '75%', placeholder: "Select subtitles", language: {noResults: () => "No subtitles found"}});
    $("#autoGenSubsLang").select2({width: '75%', placeholder: "Select auto-generated subtitles", language: {noResults: () => "No subtitles found"}} );
    $("#sponsorblockMark").select2({width: '75%', placeholder: "Select sections of a video to mark"});
    $("#sponsorblockRemove").select2({width: '75%', placeholder: "Select sections of a video to remove"});

    //Add url when user presses enter, but prevent default behavior
    $(document).on("keydown", "form", function(event) {
        if(event.key == "Enter") {
            verifyURL($('#add-url').val());
            return false;
        }
        return true
    });

    //Add url when user press on the + button
    $('#add-url-btn').on('click', () => {
        verifyURL($('#add-url').val());
    });

    $('body').on('click', '#install-btn', () => {
        window.main.invoke("installUpdate");
    }).on('click', '#tasklist-btn', () => {
        window.main.invoke("restoreTaskList");
    }).on('click', '.video-card .metadata.right button', function() {
        const card = $(this).closest('.video-card');
        updateSize($(card).prop('id'), true);
    }).on('change', '.custom-select.download-quality', function() {
        const card = $(this).closest('.video-card');
        updateSize($(card).prop('id'), false);
    }).on('change', '.custom-select.download-encoding', function() {
        const card = $(this).closest('.video-card');
        updateSize($(card).prop('id'), false);
    });

    $('#download-quality').on('change', () => updateAllVideoSettings());

    $('#download-type').on('change', async () => {
        updateAllVideoSettings();
        await getSettings();
        sendSettings();
    });

    $('#infoModal .img-overlay, #infoModal .info-img').on('click', () => {
        window.main.invoke("videoAction", {action: "downloadThumb", url: $('#infoModal .info-img').attr("src")});
    }).on('mouseover', () => {
        $('#infoModal .info-img').addClass("darken");
    }).on('mouseout', () => {
        $('#infoModal .info-img').removeClass("darken");
    });

    $('#infoModal .dismiss').on('click', () => {
        $('#infoModal').modal("hide");
    });

    $('#authModal .dismiss').on('click', () => {
        $('#authModal').modal("hide");
    });

    $('#logModal .dismiss').on('click', () => {
        $('#logModal').modal("hide");
        clearInterval(logUpdateTask);
    });

    $('#subsModal .dismiss').on('click', () => {
        $('#subsModal').modal("hide");
    });

    $('#subsModal .subsSave').on('click', () => {
        $('#subsModal').modal("hide");
    });

    $('#subsModal').on('hide.bs.modal', () => {
        saveSubtitlesModal();
    })

    $('#settingsModal .dismiss').on('click', () => {
        $('#settingsModal').modal("hide");
    });

    $('#settingsModal .apply').on('click', () => {
        $('#settingsModal').modal("hide");
        sendSettings();
    });

    $('#maxConcurrent').on('input', () => {
        $('#concurrentLabel').html(`Max concurrent jobs <strong>(${$('#maxConcurrent').val()})</strong>`);
    })

    $('#nameFormat').on('change', function() {
        const value = this.selectedOptions[0].value
        if(value !== "custom") {
            $('#nameFormatCustom').val(value).prop("disabled", true)
        } else {
            $('#nameFormatCustom').val(window.settings.nameFormat).prop("disabled", false)
        }
    })

    $('#settingsBtn').on('click', async () => {
        await getSettings();
        $('#settingsModal').modal("show");
    });

    $('#defaultConcurrent').on('click', () => {
        window.main.invoke("settingsAction", {action: "get"}).then((settings) => {
            $('#concurrentLabel').html(`Max concurrent jobs <strong>(${settings.defaultConcurrent})</strong>`);
            $('#maxConcurrent').val(settings.defaultConcurrent);
        });
    })

    $('#authBtn').on('click', () => {
        $('#authModal').modal("show");
    })

    $('#fileInput').on('click', (event) => {
        event.preventDefault();
        window.main.invoke('cookieFile', false).then((path) => {
            if(path != null)  {
                $('#fileInputLabel').html(path);
                $('#fileInput').attr("title", path);
            }
        });
    });

    window.main.invoke('cookieFile', "get").then((path) => {
        if(path != null) {
            $('#fileInputLabel').html(path);
            $('#fileInput').attr("title", path);
        }
    });

    $('.removeCookies').on('click', () => {
        window.main.invoke('cookieFile', true);
        $('#fileInputLabel').html("Click to select cookies.txt");
        $('#fileInput').attr("title", "No file selected");
    })

    $('#infoModal .json').on('click', () => {
        window.main.invoke('videoAction', {action: "downloadInfo", identifier: $('#infoModal .identifier').html()});
    });

    $('#logModal .save').on('click', () => {
        window.main.invoke('saveLog', $('#logModal .identifier').html());
    });

    $('#clearBtn').on('click', () => {
        $('.video-cards').children().each(function () {
            let identifier = this.id;
            $(getCard(identifier)).remove();
            window.main.invoke("videoAction", {action: "stop", identifier: identifier});
        })
        $('#totalProgress .progress-bar').remove();
        $('#totalProgress').prepend('<div class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>')
        window.main.invoke("iconProgress", -1);
    })

    $('#locationBtn').on('click', () => {
        window.main.invoke("downloadFolder");
    });

    $('#subtitleBtn').on('click', () => {
        let globalState = $('#subtitleBtn i').hasClass("bi-card-text-strike");
        $('.video-cards').children().each(function () {
            let state = $(this).find('.subtitle-btn i').hasClass("bi-card-text-strike");
            if(globalState === state) {
                if(state) $(this).find('.subtitle-btn i').removeClass("bi-card-text-strike").addClass("bi-card-text").attr("title", "Subtitles enabled");
                else $(this).find('.subtitle-btn i').removeClass("bi-card-text").addClass("bi-card-text-strike").attr("title", "Subtitles disabled");
            }
        })
        window.main.invoke("videoAction", {action: "globalSubtitles", value: globalState});
        if(globalState) $('#subtitleBtn i').removeClass("bi-card-text-strike").addClass("bi-card-text").attr("title", "Subtitles enabled");
        else $('#subtitleBtn i').removeClass("bi-card-text").addClass("bi-card-text-strike").attr("title", "Subtitles disabled");
    })

    $('#downloadBtn').on('click', async () => {
        let videos = []
        let videoCards = $('.video-cards').children();
        for(const card of videoCards) {
            let isDownloadable = await window.main.invoke("videoAction", {action: "downloadable", identifier: card.id})
            if(isDownloadable) {
                if($(card).hasClass("unified")) {
                    videos.push({
                        identifier: card.id,
                        url: $(card).find('.url').val(),
                        format: $(card).find('.custom-select.download-quality').val(),
                        encoding: $(card).find('.custom-select.download-encoding').val(),
                        audioEncoding: $(card).find('.custom-select.download-audio-encoding').val(),
                        type: $(card).find('.custom-select.download-type').val(),
                        downloadSubs: !$(card).find('.subtitle-btn i').hasClass("bi-card-text-strike")
                    })
                } else {
                    videos.push({
                        identifier: card.id,
                        format: $(card).find('.custom-select.download-quality').val(),
                        encoding: $(card).find('.custom-select.download-encoding').val(),
                        audioEncoding: $(card).find('.custom-select.download-audio-encoding').val(),
                        type: $(card).find('.custom-select.download-type').val(),
                        downloadSubs: !$(card).find('.subtitle-btn i').hasClass("bi-card-text-strike")
                    })
                }
                $(card).find('.progress').addClass("d-flex");
                $(card).find('.metadata.left').html('<strong>Speed: </strong>' + "0.00MiB/s").show();
                $(card).find('.metadata.right').html('<strong>ETA: </strong>' + "Unknown").show();
                $(card).find('.options').addClass("d-flex");
                $(card).find('select').addClass("d-none");
                $(card).find('.download-btn, .download-btn i, .subtitle-btn, .subtitle-btn i').addClass("disabled");
                changeDownloadIconToLog(card);
                if($(card).hasClass("unified")) {
                    $(card).find('.metadata.left, .metadata.right').empty();
                    $(card).find('.info').addClass("d-flex").removeClass("d-none");
                    $(card).find('.metadata.info').html('Downloading playlist...');
                    $(card).find('select').addClass("d-none");
                }
            }
        }
        let args = {
            action: "download",
            downloadType: "all",
            videos: videos
        }
        window.main.invoke('videoAction', args)
        $('#downloadBtn, #clearBtn').prop("disabled", true);
        updateGlobalDownloadQuality();
        $('#totalProgress .progress-bar').remove();
        $('#totalProgress').prepend('<div class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>')
        $('#totalProgress small').html(`Downloading - item 0 of ${videos.length} completed`);
    });

    //Enables the main process to show logs/errors in the renderer dev console
    window.main.receive("log", (arg) => {
        if(arg.isErr) console.error(arg.log);
        else console.log(arg.log);
    } );

    //Enables the main process to show and update toasts.
    window.main.receive("toast", (arg) => showToast(arg));

    //Passes an error to the setError method
    window.main.receive("error", (arg) => setError(arg.error.code, arg.error.description, arg.unexpected, arg.identifier, arg.url));

    //Updates the windowbar icon when the app gets maximized/unmaximized
    window.main.receive("maximized", (maximized) => {
        if(maximized) $('.windowbar').addClass("fullscreen");
        else $('.windowbar').removeClass("fullscreen");
    });

    window.main.receive("updateGlobalButtons", (arg) => {
        updateButtons(arg);
        updateGlobalDownloadQuality(arg);
    });

    window.main.receive("binaryLock", (args) => {
        if(args.lock === true) {
            $('#add-url').attr("placeholder", args.placeholder).prop("disabled", true);
        } else {
            $('#add-url').attr("placeholder", "Enter a video/playlist URL to add to the queue").prop("disabled", false);
        }
    })

    //Receive calls from main process and dispatch them to the right function
    window.main.receive("videoAction", (arg) => {
        switch(arg.action) {
            case "add":
                addVideo(arg);
                break;
            case "remove":
                $(getCard(arg.identifier)).remove();
                sizeCache = sizeCache.filter(item => item[0] !== arg.identifier)
                updateTotalSize();
                break;
            case "progress":
                updateProgress(arg);
                break;
            case "totalProgress":
                updateTotalProgress(arg);
                break;
            case "info":
                showInfoModal(arg.metadata, arg.identifier);
                break;
            case "setUnified":
                setUnifiedPlaylist(arg);
                break;
            case "setDownloadType":
                $('#download-type').val(arg.type);
                updateAllVideoSettings();
                break;
        }
    });

    //Opens the input menu (copy/paste) when an editable object gets right clicked.
    document.body.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let node = e.target;
        while (node) {
            if (node.nodeName.match(/^(input|textarea)$/i) || node.isContentEditable) {
                window.main.invoke('openInputMenu');
                break;
            } else if (node.nodeName.match(/^(a)$/i)) {
                window.main.invoke('openCopyMenu', $(node).prop('href'));
                break;
            }
            node = node.parentNode;
        }
    });
}

function verifyURL(value) {
    if (linkCopied && (value == null || value.length === 0)) {
        parseURL($('#add-url').prop('placeholder'));
        $('#url-form').trigger('reset');
    } else if ($('#url-form')[0].checkValidity()) {
        if (value != null && value.length > 0) {
            parseURL(value);
            $('#url-form').trigger('reset');
        }
    }
}

function toggleWhiteMode(setting) {
    const value = setting === "light";
    $('body').toggleClass("white-mode", value);
    $('.windowbar-minimize, .windowbar-maximize, .windowbar-close > svg').toggleClass("invert", value);
    $('.windowbar > img').attr('src', "img/icon-titlebar-" + (value ? "light" : "dark") + ".png");
    $('#downloadBtn').toggleClass("desaturate", value);
    $('#subtitleBtn > i').toggleClass("light-icon", value);
}

function parseURL(data) {
    if(data.includes(',')) {
        let urls = data.replaceAll(" ", "").split(",");
        for(const url of urls) {
            window.main.invoke('videoAction', {action: "entry", url: url});
        }
    } else {
        window.main.invoke('videoAction', {action: "entry", url: data});
    }
}

function showToast(toastInfo) {
    if(toastInfo.title != null) {
        $(`.${toastInfo.type}-title`).html(toastInfo.title);
    }
    if(toastInfo.body != null) {
        $(`.${toastInfo.type}-body`).html(toastInfo.body);
    }
    if($(`#${toastInfo.type}`).is(':visible')) $(`#${toastInfo.type}`).toast('show').css('visibility', 'visible');
}

function updateEncodingDropdown(enabled) {
    $('.video-cards').children().each(function() {
        $(this).find('.metadata').toggle(!enabled);
        $(this).find('.custom-select.download-encoding, .custom-select.download-audio-encoding').toggle(enabled);
    })
}

function updateGlobalDownloadQuality() {
    const formats = [];
    const currentFormats = [];
    $('.video-cards').children().each(function() {
        if($(this).find('.download-btn i').hasClass("disabled")) return;
        if($(this).find('.custom-select.download-type').val() !== "audio") {
            $(this).find('.custom-select.download-quality option.video').each(function () {
                formats.push($(this).val());
            })
        }
    })
    const sortedFormats = [...new Set(formats)];
    sortedFormats.sort((a, b) => {
        const aParsed = parseFormatString(a);
        const bParsed = parseFormatString(b);
        return parseInt(bParsed.height, 10) - parseInt(aParsed.height, 10) || parseInt(bParsed.fps, 10) - parseInt(aParsed.fps, 10);
    });
    $('#download-quality option.video').each(function() {
        currentFormats.push(this.value);
        if(!sortedFormats.includes(this.value)) {
            $(this).remove();
        }
    })
    for(const format of sortedFormats) {
        const option = new Option(format, format);
        if(!currentFormats.includes(format)) {
            $('#download-quality').append(option);
            $(option).addClass("video");
        }
    }
}

function parseFormatString(string) {
    let split = string.split("p");
    let height = split[0];
    let fps = split[1];
    if(fps === "") fps = null;
    return {
        fps: fps,
        height: height
    };
}

async function addVideo(args) {
    await getSettings();
    let template = $('.template.video-card').clone();
    $(template).removeClass('template');
    $(template).prop('id', args.identifier);
    if(args.type === "single") {
        $(template).find('.card-title')
            .html(args.title)
            .prop('title', args.title);
        $(template).find('.progress-bar')
            .addClass('progress-bar-striped')
            .addClass('progress-bar-animated')
            .width("100%");
        if(args.subtitles) $(template).find('.subtitle-btn i').removeClass("bi-card-text-strike").addClass("bi-card-text").attr("title", "Subtitles enabled");
        $(template).find('img').prop("src", args.thumbnail);
        $(template).find('.info').addClass("d-none");
        $(template).find('.progress small').html("Setting up environment")
        $(template).find('.metadata.left').html('<strong>Duration: </strong>' + ((args.duration == null) ? "Unknown" : args.duration));
        if(window.settings.enableEncoding) {
            $(template).find('.metadata').hide();
        } else {
            $(template).find('.custom-select.download-encoding, .custom-select.download-audio-encoding').hide();
        }

        if(!args.hasFilesizes) {
            $(template).find('.metadata.right').html('<strong>Size: </strong>Unknown');
        } else if(args.loadSize) {
            $(template).find('.metadata.right').html('<strong>Size: </strong><i class="lds-dual-ring"></i>');
        } else {
            $(template).find('.metadata.right').html('<strong>Size: </strong><button class="btn btn-dark">Load</button>')
        }

        $(template).find('.custom-select.download-type').on('change', function () {
            let isAudio = this.selectedOptions[0].value === "audio";
            disableEncodingDropdowns(this.selectedOptions[0].value, template);
            for(const elem of $(template).find('option')) {
                if($(elem).hasClass("video")) {
                    $(elem).toggle(!isAudio)
                } else if($(elem).hasClass("audio")) {
                    $(elem).toggle(isAudio)
                }
            }
            if (args.formats.length > 0) {
                $(template).find('.custom-select.download-quality').val(isAudio ? "best" : args.formats[args.selected_format_index].display_name).change();
            }
        });

        if(args.formats.length === 0) {
            $(template).find('.custom-select.download-quality').append(new Option("No formats", "", true)).prop("disabled", true);
            $(template).find('.custom-select.download-type').prop("disabled", true);
            $(template).find('.subtitle-btn, .subtitle-btn i').addClass("disabled");
        }

        setCodecs(template, args.audioCodecs, args.formats);

        $(template).find('.custom-select.download-quality').on('change', function () {
            updateCodecs(template, this.value);
        });

        $(template).find('.custom-select.download-type').change();

        //Initialize remove video popover
        $(template).find('.remove-btn').popover();
        $(document).click(function(event) {
            let target = $(event.target);
            if(!target.closest('.remove-btn').length) {
                $('.remove-btn').removeClass("clicked").popover("hide");
            }
        });

        $(template).find('.remove-btn').on('click', () => removeVideo(getCard(args.identifier)));

        $(template).find('.download-btn').on('click', () => {
            let downloadArgs = {
                action: "download",
                url: args.url,
                identifier: args.identifier,
                format: $(template).find('.custom-select.download-quality').val(),
                encoding: $(template).find('.custom-select.download-encoding').val(),
                audioEncoding: $(template).find('.custom-select.download-audio-encoding').val(),
                type: $(template).find('.custom-select.download-type').val(),
                downloadType: "single"
            }
            window.main.invoke("videoAction", downloadArgs)
            $('#downloadBtn, #clearBtn').prop("disabled", true);
            updateGlobalDownloadQuality();
            $(template).find('.progress').addClass("d-flex");
            $(template).find('.metadata.left').html('<strong>Speed: </strong>' + "0.00MiB/s").show();
            $(template).find('.metadata.right').html('<strong>ETA: </strong>' + "Unknown").show();
            $(template).find('.options').addClass("d-flex");
            $(template).find('select').addClass("d-none");
            $(template).find('.download-btn i, .download-btn, .subtitle-btn, .subtitle-btn i').addClass("disabled");
            if(!$(template).hasClass("unified")) {
                changeDownloadIconToLog(template);
            }
        });

        $(template).find('.subtitle-btn').on('click', () => {
            showSubtitleModal(args.identifier, template);
        });

        $(template).find('.info-btn').on('click', () => {
            window.main.invoke("videoAction", {action: "info", identifier: args.identifier});
        });

        $(template).find('.open .folder').on('click', () => {
            window.main.invoke("videoAction", {action: "open", identifier: args.identifier, type: "folder"});
        });
        $(template).find('.open .item').on('click', () => {
            window.main.invoke("videoAction", {action: "open", identifier: args.identifier, type: "item"});
        });

    } else if(args.type === "metadata") {
        $(template).find('.card-title')
            .html(args.url)
            .prop('title', args.url);
        $(template).find('.progress-bar')
            .addClass('progress-bar-striped')
            .addClass('progress-bar-animated')
            .width("100%")
            .prop("aria-valuenow", "indefinite");
        $(template).find('.progress').addClass("d-flex");
        $(template).find('.options').addClass("d-none");
        $(template).find('.metadata.info').html('Downloading metadata...');
        $(template).find('.buttons').children().each(function() { $(this).find('i').addClass("disabled"); $(this).addClass("disabled"); });
        $(template).find('.remove-btn').on('click', () => removeVideo(getCard(args.identifier)));

    } else if(args.type === "playlist") {
        $(template).find('.card-title')
            .html(args.url)
            .prop('title', args.url);
        $(template).find('.progress small')
            .html('Setting up environment')
        $(template).find('.progress-bar')
            .addClass('progress-bar-striped')
            .addClass('progress-bar-animated')
            .width("100%")
            .prop("aria-valuenow", "indefinite");
        $(template).find('.progress').addClass("d-flex");
        $(template).find('.options').addClass("d-none");
        $(template).find('.metadata.info').html('Fetching video metadata...');
        $(template).find('.buttons').children().each(function() { $(this).find('i').addClass("disabled"); $(this).addClass("disabled"); });
        $(template).find('.remove-btn').on('click', () => removeVideo(getCard(args.identifier)));
    }

    new Promise((resolve) => {
        $(template).find('img').on('load error', () => resolve());
    }).then(() => {
        $('.video-cards').prepend(template);
        if(args.type === "single") updateVideoSettings(args.identifier);
    });

}

function removeVideo(card) {
    const btn = $(card).find('.remove-btn')
    if(btn.hasClass("clicked") || $(card).find(".custom-select.download-type").is(":visible") || $(card).find(".btn.btn-dark.folder").is(":visible") || $(card).find(".row.error.d-none").is(":visible") || $(card).find(".url").length) {
        $(btn).popover('hide');
        $(card).remove();
        window.main.invoke("videoAction", {action: "stop", identifier: $(card).prop("id")});
    } else {
        $(btn).popover('show');
        $(btn).addClass("clicked");
    }
}

async function setUnifiedPlaylist(args) {
    await getSettings();
    const card = getCard(args.identifier);
    $(card).addClass("unified");
    $(card).append(`<input type="hidden" class="url" value="${args.url}">`);
    $(card).find('.progress').addClass("d-none").removeClass("d-flex");
    $(card).find('.options').addClass("d-flex");
    $(card).find('.info').addClass("d-none").removeClass("d-flex");
    $(card).find('.metadata.right').html('<strong>Playlist size: </strong>' + args.length);
    $(card).find('.metadata.left').html('<strong>Uploader: </strong>' + (args.uploader == null ? "Unknown" : args.uploader));
    if(window.settings.enableEncoding) {
        $(card).find('.metadata').hide();
    } else {
        $(card).find('.custom-select.download-encoding, .custom-select.download-audio-encoding').hide();
    }
    if(args.subtitles) $(card).find('.subtitle-btn i').removeClass("bi-card-text-strike").addClass("bi-card-text").attr("title", "Subtitles enabled");
    $(card).find('img').prop("src", args.thumb);
    $(card).find('.card-title')
        .html(args.title)
        .prop('title', args.title);
    $(card).find('.progress-bar')
        .addClass('progress-bar-striped')
        .addClass('progress-bar-animated')
        .width("100%")
        .prop("aria-valuenow", "indefinite");
    $(card).find('.progress small').html('Setting up environment');
    $(card).find('.download-btn i, .download-btn, .subtitle-btn, .subtitle-btn i, .remove-btn i, .remove-btn').removeClass("disabled");

    $(card).find('.subtitle-btn').on('click', () => {
        showSubtitleModal(args.identifier, card);
    });

    $(card).find('.custom-select.download-type').on('change', function () {
        disableEncodingDropdowns(this.selectedOptions[0].value, card);
        let isAudio = this.selectedOptions[0].value === "audio";
        for(const elem of $(card).find('option')) {
            if($(elem).hasClass("video")) {
                $(elem).toggle(!isAudio)
            } else if($(elem).hasClass("audio")) {
                $(elem).toggle(isAudio)
            }
        }
        $(card).find('.custom-select.download-quality').val(isAudio ? "best" : args.formats[0].display_name).change();
    });

    $(card).find('.download-btn').on('click', () => {
        let downloadArgs = {
            action: "download",
            identifier: args.identifier,
            format: $(card).find('.custom-select.download-quality').val(),
            type: $(card).find('.custom-select.download-type').val(),
            encoding: $(card).find('.custom-select.download-encoding').val(),
            audioEncoding: $(card).find('.custom-select.download-audio-encoding').val(),
            downloadType: "unified"
        }
        window.main.invoke("videoAction", downloadArgs);
        $('#downloadBtn, #clearBtn').prop("disabled", true);
        updateGlobalDownloadQuality();
        $(card).find('.progress').addClass("d-flex");
        $(card).find('.metadata.left, .metadata.right').empty();
        $(card).find('.info').addClass("d-flex").removeClass("d-none");
        $(card).find('.metadata.info').html('Downloading playlist...');
        $(card).find('select').addClass("d-none");
        $(card).find('.download-btn i, .download-btn, .subtitle-btn, .subtitle-btn i').addClass("disabled");
    });

    setCodecs(card, args.audioCodecs, args.formats);

    $(card).find('.custom-select.download-quality').on('change', function () {
        updateCodecs(card, this.value);
    });

    $(card).find('.custom-select.download-type').change();

    $(card).find('.open .folder').on('click', () => {
        window.main.invoke("videoAction", {action: "open", identifier: args.identifier, type: "folder"});
    });
    updateVideoSettings(args.identifier);
}

function setCodecs(card, audioCodecs, formats) {
    //Add the audio encoding
    for(const audioCodec of audioCodecs) {
        let codecOption = new Option(audioCodec, audioCodec);
        $(card).find('.custom-select.download-audio-encoding').append(codecOption);
    }

    for(const format of formats) {
        //Add the quality (1080p60)
        let option = new Option(format.display_name, format.display_name);
        $(card).find('.custom-select.download-quality').append(option);
        $(option).addClass("video");

        //Add the encoding (vp9) associated with the quality (1080p60)
        for(const encoding of format.encodings) {
            let encodingOption = new Option(encoding, encoding);
            $(card).find('.custom-select.download-encoding').append(encodingOption);
            $(encodingOption).addClass(format.display_name);
        }
    }
}

function updateCodecs(card, newValue) {
    const encodingValue = $(card).find('.custom-select.download-encoding :selected').val();
    for(const elem of $(card).find('.custom-select.download-encoding option')) {
        if($(elem).hasClass(newValue)) {
            $(elem).show();
        } else if(!$(elem).hasClass("none")) {
            $(elem).hide();
        }
    }
    let foundElement = false;
    for(const elem of $(card).find('.custom-select.download-encoding option')) {
        if($(elem).val() === encodingValue && $(elem).hasClass(newValue)) {
            $(elem).attr('selected','selected');
            foundElement = true;
            break;
        }
    }
    if(!foundElement) {
        $(card).find('.custom-select.download-encoding').val("none");
    }
}

function updateProgress(args) {
    let card = getCard(args.identifier);
    if(args.progress.reset != null && args.progress.reset) {
        resetProgress($(card).find('.progress-bar')[0], card);
        return;
    }
    if(args.progress.initial != null && args.progress.initial) {
        $(card).find('.progress small').html(args.progress.message);
        return;
    }
    if(args.progress.finished != null && args.progress.finished) {
        if(args.progress.isPlaylist) {
            $(card).find('.progress small').html("Playlist downloaded - 100%");
            $(card).find('.progress-bar').attr('aria-valuenow', 100).css('width', "100%");
            $(card).find('.options').addClass("d-none").removeClass("d-flex");
            $(card).find('.info').addClass("d-none").removeClass("d-flex");
            $(card).find('.progress-bar').removeClass("progress-bar-striped")
            $(card).find('.open .item').addClass("d-none");
            $(card).find('.open .folder').html("Show files in folder");
            $(card).find('.open').addClass("d-flex");
        } else {
            if(args.progress.isAudio == null) $(card).find('.progress small').html("Item downloaded - 100%");
            else $(card).find('.progress small').html((args.progress.isAudio ? "Audio" : "Video") + " downloaded - 100%");
            $(card).find('.progress-bar').attr('aria-valuenow', 100).css('width', "100%");
            $(card).find('.options').addClass("d-none").removeClass("d-flex");
            $(card).find('.progress-bar').removeClass("progress-bar-striped")
            $(card).find('.open').addClass("d-flex");
            if(window.settings.nameFormatMode === "custom") $(card).find('.open .item').prop("disabled", true)
        }
        changeSubsToRetry(args.url, card);
        return;
    }
    if(args.progress.done != null && args.progress.total != null) {
        if($(card).find('.progress-bar').hasClass("progress-bar-striped")) {
            resetProgress($(card).find('.progress-bar')[0], card);
        }
        $(card).find('.progress-bar').attr('aria-valuenow', args.progress.percentage.slice(0,-1)).css('width', args.progress.percentage);
        $(card).find('.progress small').html(`${args.progress.percentage} - ${args.progress.done} of ${args.progress.total} `);
    } else if(args.progress.percentage != null) {
        if(parseFloat(args.progress.percentage.slice(0, -1)) > parseFloat($(card).find('.progress-bar').attr("aria-valuenow"))) {
            $(card).find('.progress-bar').attr('aria-valuenow', args.progress.percentage.slice(0,-1)).css('width', args.progress.percentage);
            if(args.progress.percentage.slice(0, -1) === "100.0") {
                $(card).find('.progress-bar').addClass("progress-bar-striped")
                $(card).find('.progress small').html("Converting with FFmpeg");
            } else {
                if (args.progress.isAudio == null) $(card).find('.progress small').html("Downloading item - " + args.progress.percentage);
                else $(card).find('.progress small').html((args.progress.isAudio ? "Downloading audio" : "Downloading video") + " - " + args.progress.percentage);
            }
            if(!progressCooldown.includes(args.identifier)) {
                progressCooldown.push(args.identifier);
                $(card).find('.metadata.right').html('<strong>ETA: </strong>' + args.progress.eta).show();
                $(card).find('.metadata.left').html('<strong>Speed: </strong>' + args.progress.speed).show();
                setTimeout(() => {
                    progressCooldown = progressCooldown.filter(item => item !== args.identifier);
                }, 200);
            }
        }
    }
}

function updateTotalProgress(args) {
    if(args.progress.resetTotal != null && args.progress.resetTotal) {
        resetTotalProgress();
        return;
    }
    $('#totalProgress small').html(`Downloading - item ${args.progress.done} of ${args.progress.total} completed`);
    $('#totalProgress .progress-bar').css("width", args.progress.percentage).attr("aria-valuenow", args.progress.percentage.slice(0,-1));
    const ratio = parseFloat(args.progress.percentage.slice(0,-1));
    window.main.invoke("iconProgress", ratio / 100);
}

function updateSize(identifier, clicked) {
    if(sizeCooldown.includes(identifier)) return;
    sizeCooldown.push(identifier)
    const card = getCard(identifier);
    if($(card).hasClass('unified')) {
        sizeCooldown = sizeCooldown.filter(item => item !== identifier);
        return;
    }
    if($(card).find('.custom-select.download-quality').prop("disabled") === true) {
        sizeCooldown = sizeCooldown.filter(item => item !== identifier);
        $(card).find('.metadata.right').html('<strong>Size: </strong>' + "Unknown");
        return;
    }
    const formatLabel = $(card).find('.custom-select.download-quality').val();
    $(card).find('.metadata.right').html('<strong>Size: </strong><i class="lds-dual-ring"></i>');
    window.main.invoke("videoAction", {
        action: "getSize",
        identifier: identifier,
        formatLabel: formatLabel,
        encoding: $(card).find('.custom-select.download-encoding').val(),
        audioEncoding: $(card).find('.custom-select.download-audio-encoding').val(),
        audioOnly: $(card).find('.custom-select.download-type').val() === "audio",
        videoOnly: $(card).find('.custom-select.download-type').val() === "videoOnly",
        clicked: clicked
    }).then((size) => {
        if(size != null && size === "Unknown") {
            $(card).find('.metadata.right').html('<strong>Size: </strong>' + "Unknown");
        } else if(size != null) {
            if($(card).find('.custom-select.download-quality').val() === formatLabel) {
                sizeCache = sizeCache.filter(item => item[0] !== identifier)
                sizeCache.push([identifier, size]);
                $(card).find('.metadata.right').html('<strong>Size: </strong>' + convertBytes(size));
            }
        } else {
            $(card).find('.metadata.right').html('<strong>Size: </strong><button class="btn btn-dark">Load</button>');
        }
        sizeCooldown = sizeCooldown.filter(item => item !== identifier)
        updateTotalSize();
    });
}

async function updateVideoSettings(identifier) {
    const card = getCard(identifier);
    const qualityValue = $('#download-quality').val();
    const typeValue = $('#download-type').val();
    const oldQuality = $(card).find('.custom-select.download-quality');
    const oldType = $(card).find('.custom-select.download-type').val();
    $(card).find('.custom-select.download-type').val(typeValue);
    const classValue = typeValue === "videoOnly" ? "video" : typeValue;
    let isAudio = typeValue === "audio";
    if(qualityValue === "best") {
        $(card).find('.custom-select.download-quality').val($(card).find(`.custom-select.download-quality option.${classValue}:first`).val());
    } else if(qualityValue === "worst") {
        if(isAudio) {
            $(card).find('.custom-select.download-quality').val("worst");
        } else {
            $(card).find('.custom-select.download-quality').val($(card).find(`.custom-select.download-quality option.${classValue}:last`).val());
        }
    } else if(!isAudio) {
        const formats = [];
        $(card).find('.custom-select.download-quality option.video').each(function() {
            formats.push(this.value);
        });
        if(formats.includes(qualityValue)) {
            $(card).find('.custom-select.download-quality').val(qualityValue);
        } else {
            const search = parseFormatString(qualityValue);
            const closest = formats.reduce((a, b) => {
                const parsedA = parseFormatString(a);
                const parsedB = parseFormatString(b);
                return Math.abs(parsedB.height - search.height) < Math.abs(parsedA.height - search.height) ? b : a;
            });
            $(card).find('.custom-select.download-quality').val(closest);
        }
    } else if(isAudio) {
        $('#download-quality').val("best");
        $(card).find('.custom-select.download-quality').val($(card).find(`.custom-select.download-quality option.${classValue}:first`).val());
    }
    disableEncodingDropdowns(typeValue, card);
    for(const elem of $(card).find('option')) {
        if($(elem).hasClass("video")) {
            $(elem).toggle(!isAudio)
        } else if($(elem).hasClass("audio")) {
            $(elem).toggle(isAudio)
        }
    }
    updateCodecs(card, $(card).find('.custom-select.download-quality').val())
    if($(card).hasClass("unified")) return;
    await getSettings();
    if(oldQuality != null && oldType != null && (oldQuality !== $(card).find('.custom-select.download-quality').val() || oldType !== $(card).find('.custom-select.download-type').val())) {
        updateSize(identifier, false);
    } else if(window.settings.sizeMode === "full") {
        updateSize(identifier, false);
    }
}

function disableEncodingDropdowns(typeValue, card) {
    let isAudio = typeValue === "audio";
    let isVideoOnly = typeValue === "videoOnly";
    $(card).find(".custom-select.download-encoding").prop("disabled", isAudio && !isVideoOnly);
    $(card).find(".custom-select.download-audio-encoding").prop("disabled", !isAudio && isVideoOnly);
}

function updateAllVideoSettings() {
    let isAudio = $('#download-type').val() === "audio";
    for(const elem of $('#download-quality option')) {
        if($(elem).hasClass("video")) {
            $(elem).toggle(!isAudio)
        }
    }
    $('.video-cards').children().each(function () {
        updateVideoSettings($(this).prop("id"));
    });
}

async function getSettings() {
    const settings = await window.main.invoke("settingsAction", {action: "get"});
    $('#updateBinary').prop('checked', settings.updateBinary);
    $('#updateApplication').prop('checked', settings.updateApplication);
    $('#userAgent').val(settings.userAgent);
    $('#validateCertificate').prop('checked', settings.validateCertificate);
    $('#enableEncoding').prop('checked', settings.enableEncoding);
    $('#taskList').prop('checked', settings.taskList);
    $('#autoFillClipboard').prop('checked', settings.autoFillClipboard);
    $('#noPlaylist').prop('checked', settings.noPlaylist);
    $('#globalShortcut').prop('checked', settings.globalShortcut);
    $('#ratelimitSetting').val(settings.rateLimit);
    $('#proxySetting').val(settings.proxy);
    $('#nameFormatCustom').val(settings.nameFormat).prop("disabled", settings.nameFormatMode === "custom");
    $('#nameFormat').val(settings.nameFormatMode);
    $('#outputFormat').val(settings.outputFormat);
    $('#audioOutputFormat').val(settings.audioOutputFormat);
    $('#sponsorblockMark').val(settings.sponsorblockMark.split(",")).change();
    $('#sponsorblockRemove').val(settings.sponsorblockRemove.split(",")).change();
    $('#sponsorblockApi').val(settings.sponsorblockApi);
    $('#downloadMetadata').prop('checked', settings.downloadMetadata);
    $('#downloadJsonMetadata').prop('checked', settings.downloadJsonMetadata);
    $('#downloadThumbnail').prop('checked', settings.downloadThumbnail);
    $('#keepUnmerged').prop('checked', settings.keepUnmerged);
    $('#calculateTotalSize').prop('checked', settings.calculateTotalSize);
    $('#maxConcurrent').val(settings.maxConcurrent);
    $('#concurrentLabel').html(`Max concurrent jobs <strong>(${settings.maxConcurrent})</strong>`);
    $('#sizeSetting').val(settings.sizeMode);
    $('#splitMode').val(settings.splitMode);
    $('#theme').val(settings.theme);
    $('#version').html("<strong>Version: </strong>" + settings.version);
    window.settings = settings;
}

function sendSettings() {
    let settings = {
        updateBinary: $('#updateBinary').prop('checked'),
        updateApplication: $('#updateApplication').prop('checked'),
        autoFillClipboard: $('#autoFillClipboard').prop('checked'),
        noPlaylist: $('#noPlaylist').prop('checked'),
        globalShortcut: $('#globalShortcut').prop('checked'),
        outputFormat: $('#outputFormat').val(),
        audioOutputFormat: $('#audioOutputFormat').val(),
        proxy: $('#proxySetting').val(),
        userAgent: $('#userAgent').val(),
        validateCertificate: $('#validateCertificate').prop('checked'),
        enableEncoding: $('#enableEncoding').prop('checked'),
        taskList: $('#taskList').prop('checked'),
        nameFormatMode: $('#nameFormat').val(),
        nameFormat: $('#nameFormatCustom').val(),
        sponsorblockMark: $('#sponsorblockMark').val().join(","),
        sponsorblockRemove: $('#sponsorblockRemove').val().join(","),
        sponsorblockApi: $('#sponsorblockApi').val(),
        downloadMetadata: $('#downloadMetadata').prop('checked'),
        downloadJsonMetadata: $('#downloadJsonMetadata').prop('checked'),
        downloadThumbnail: $('#downloadThumbnail').prop('checked'),
        keepUnmerged: $('#keepUnmerged').prop('checked'),
        calculateTotalSize: $('#calculateTotalSize').prop('checked'),
        sizeMode: $('#sizeSetting').val(),
        splitMode: $('#splitMode').val(),
        rateLimit: $('#ratelimitSetting').val(),
        maxConcurrent: parseInt($('#maxConcurrent').val()),
        downloadType: $('#download-type').val(),
        theme: $('#theme').val()
    }
    window.settings = settings;
    window.main.invoke("settingsAction", {action: "save", settings});
    updateEncodingDropdown(settings.enableEncoding);
    toggleWhiteMode(settings.theme);
}

async function updateTotalSize() {
    await getSettings();
    if(!window.settings.calculateTotalSize) return;
    let total = 0;
    for(const elem of sizeCache) {
        total += elem[1];
    }
    if(total > 0) $('#totalProgress small').html('Ready to download! - Total queried size: ' + convertBytes(total));
    else  $('#totalProgress small').html('Ready to download!');
}

function saveSubtitlesModal() {
    const modal = $('#subsModal');
    const identifier = $(modal).find('.identifier').val();
    const card = getCard(identifier);
    const subs = $('#subsLang').select2('data').map((option => option.id));
    const autoGen = $('#autoGenSubsLang').select2('data').map(option => option.id);
    if($(modal).find('#enableSubs').is(":checked")) $(card).find('.subtitle-btn i').removeClass("bi-card-text-strike").addClass("bi-card-text").attr("title", "Subtitles enabled");
    else $(card).find('.subtitle-btn i').removeClass("bi-card-text").addClass("bi-card-text-strike").attr("title", "Subtitles disabled");
    window.main.invoke("videoAction", {action: "setSubtitles", identifier: identifier, subs: subs, autoGen: autoGen, enabled: $(modal).find('#enableSubs').prop('checked'), unified: $(card).hasClass("unified")});
}

async function showSubtitleModal(identifier, card) {
    const modal = $('#subsModal');
    const availableLangs = await window.main.invoke("getSubtitles", {identifier: identifier, unified: $(card).hasClass("unified")});
    const selectedLangs = await window.main.invoke("getSelectedSubtitles", {identifier: identifier});
    if($(modal).find('.identifier').length) {
        $(modal).find('.identifier').val(identifier);
    } else {
        $(modal).append(`<input type="hidden" class="identifier" value="${identifier}">`);
    }
    $(modal).find('#subsLang').empty();
    if(availableLangs[0].length === 0) {
        $(modal).find('#subsLang').closest("div").css("display", "none");
    } else {
        $(modal).find('#subsLang').closest("div").css("display", "initial");
        for (const lang of availableLangs[0]) {
            let option = new Option(lang.name, lang.iso);
            $(modal).find('#subsLang').append(option);
        }
    }
    $(modal).find('#autoGenSubsLang').empty();
    if(availableLangs[1].length === 0) {
        $(modal).find('#autoGenSubsLang').closest("div").css("display", "none");
    } else {
        $(modal).find('#autoGenSubsLang').closest("div").css("display", "initial");
        for(const lang of availableLangs[1]) {
            let option = new Option(lang.name, lang.iso);
            $(modal).find('#autoGenSubsLang').append(option);
        }
    }
    $(modal).find('#autoGenSubsLang, #subsLang').unbind('select2:select').on('select2:select', () => {
        $(modal).find('#enableSubs').prop("checked", true);
    });
    if(availableLangs[0].length === 0 && availableLangs[1].length === 0) {
        $(modal).find('.description').text("No subtitles available.")
        $(modal).find('#enableSubs').prop("checked", false).prop("disabled", true);
    } else {
        if($(card).hasClass("unified")) {
            $(modal).find('.description').html("Select the subtitle languages you want to try to download.")
        } else {
            $(modal).find('.description').text("Select the subtitle languages you want to download.")
        }
        $(modal).find('#enableSubs').prop("disabled", false);
    }
    $(modal).find('#subsLang').val(selectedLangs[0]);
    $(modal).find('#autoGenSubsLang').val(selectedLangs[1]);
    modal.modal("show");
}

function showInfoModal(info, identifier) {
    let modal = $('#infoModal');
    let data = info;
    if(data == null) {
        const card = getCard(identifier);
        data = {
            title: $(card).find('.card-title').text(),
            description: "This video threw an error. Not all info is available.\n\nError:\n" + $(card).find('.metadata').text(),
            url: $(card).find('.url').val()
        }
    }
    $(modal).find('img').prop("src", data.thumbnail);
    $(modal).find('.modal-title').html(data.title);
    $(modal).find('#info-description').html(data.description == null ? "No description was found." : data.description);
    $(modal).find('.uploader').html('<strong>Uploader: </strong>' + (data.uploader == null ? "Unknown" : data.uploader));
    $(modal).find('.extractor').html('<strong>Extractor: </strong>' + (data.extractor == null ? "Unknown" : data.extractor));
    $(modal).find('.url').html('<strong>URL: </strong>' + '<a target="_blank" href="' + data.url + '">' + data.url + '</a>');
    $(modal).find('[title="Views"]').html('<i class="bi bi-eye"></i> ' + (data.view_count == null ? "-" : data.view_count));
    $(modal).find('[title="Like / dislikes"]').html('<i class="bi bi-hand-thumbs-up"></i> ' + (data.like_count == null ? "-" : data.like_count) + ' &nbsp;&nbsp; <i class="bi bi-hand-thumbs-down"></i> ' + (info.dislike_count == null ? "-" : info.dislike_count));
    $(modal).find('[title="Average rating"]').html('<i class="bi bi-star"></i> ' + (data.average_rating == null ? "-" : data.average_rating.toString().slice(0,3)));
    $(modal).find('[title="Duration"]').html('<i class="bi bi-clock"></i> ' + (data.duration == null ? "-" : data.duration));
    $(modal).find('.identifier').html(identifier);
    $(modal).modal("show");
}

function resetProgress(elem, card) {
    $(elem).removeClass("progress-bar-striped").removeClass("progress-bar-animated");
    $(elem).remove();
    $(card).find('.progress').prepend('<div class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>')
}

function resetTotalProgress() {
    $('#totalProgress .progress-bar').remove();
    $('#totalProgress').prepend('<div class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>')
    $('#totalProgress small').html('Ready to download!');
    window.main.invoke("iconProgress", -1);
}

function updateButtons(videos) {
    let downloadableVideos = false;

    if(videos.length > 0) $('#clearBtn').prop("disabled", false);
    else $('#clearBtn').prop("disabled", true);

    for(const video of videos) {
        let domVideo = getCard(video.identifier);
        if(domVideo == null) continue;
        if(video.downloadable) {
            $('#downloadBtn').prop("disabled", false);
            downloadableVideos = true;
            break;
        }
        if(!downloadableVideos) {
            $('#downloadBtn').prop("disabled", true);
        }
    }
}

function changeSubsToRetry(url, card) {
    if(card == null) return;
    $(card).find('.subtitle-btn')
        .unbind()
        .removeClass("subtitle-btn")
        .removeClass("disabled")
        .addClass("retry-btn")
        .html('<i title="Retry" class="bi bi-arrow-counterclockwise"></i>')
        .on('click', function() {
            window.main.invoke("videoAction", {action: "stop", identifier: $(card).prop("id")});
            if(url == null) {
                parseURL($(card).find('.url').val());
            } else {
                parseURL(url);
            }
        })
        .find('i').removeClass("disabled");
}

function changeDownloadIconToLog(card) {
    if(card == null) return;
    $(card).find('.download-btn i')
        .unbind()
        .removeClass("bi-download")
        .removeClass("disabled")
        .addClass("bi-journal-text")
        .on('click', () => {
            const id = $(card).prop('id');
            $('#logModal').modal("show").find('.identifier').html(id);
            $('#logModal .log').html("Loading log...");
            openLog(id);
            logUpdateTask = setInterval(() => openLog(id), 1000);
        });
    $(card).find('.download-btn')
        .unbind()
        .removeClass("disabled");
}

function openLog(identifier) {
    const logBox = $('#logModal .log');
    window.main.invoke("getLog", identifier).then(log => {
        if(log == null) {
            $(logBox).val("No log was found for this video.")
        } else {
            let fullLog = "";
            for(const line of log) {
                if(line.startsWith("WARNING")) {
                    const pre = line.slice(0, line.indexOf("W")) + "<strong>" + line.slice(line.indexOf("W"));
                    const suffixed = pre.slice(0, pre.indexOf(":") + 1) + "</strong>" + pre.slice(pre.indexOf(":") + 1);
                    fullLog += "<p class='text-warning'>" + suffixed + "</p>";
                } else if(line.startsWith("ERROR")) {
                    const pre = line.slice(0, line.indexOf("E")) + "<strong>" + line.slice(line.indexOf("E"));
                    const suffixed = pre.slice(0, pre.indexOf(":") + 1) + "</strong>" + pre.slice(pre.indexOf(":") + 1);
                    fullLog += "<p class='text-danger'>" + suffixed + "</p>";
                } else if(line.startsWith("[")) {
                    const pre = line.slice(0, line.indexOf("[")) + "<strong>" + line.slice(line.indexOf("["));
                    const suffixed = pre.slice(0, pre.indexOf("]") + 1) + "</strong>" + pre.slice(pre.indexOf("]") + 1);
                    fullLog += "<p>" + suffixed + "</p>";
                } else {
                    fullLog += "<p><strong>" + line + "</strong></p>";
                }
            }
            $(logBox).html(fullLog);
        }
    })
}

function setError(code, description, unexpected, identifier, url) {
    let card = getCard(identifier);
    $(card).append(`<input type="hidden" class="url" value="${url}">`);
    $(card).find('.progress-bar').removeClass("progress-bar-striped").removeClass("progress-bar-animated").css("width", "100%").css('background-color', 'var(--error-color)');
    $(card).find('.buttons').children().each(function() {
        if($(this).hasClass("remove-btn") || $(this).hasClass("info-btn") || $(this).find("i").hasClass("bi-journal-text")) {
            $(this).removeClass("disabled").find('i').removeClass("disabled");
        } else if($(this).hasClass("subtitle-btn")) {
            changeSubsToRetry(url, card);
        } else {
            $(this).addClass("disabled").find('i').addClass("disabled");
        }
    });
    $(card).find('.info-btn').on('click', () => {
        window.main.invoke("videoAction", {action: "info", identifier: identifier});
    });
    $(card).find('.report').prop("disabled", false);
    $(card).css("box-shadow", "none").css("border", "solid 1px var(--error-color)");
    $(card).find('.progress small').html("Error! " + code + ".");
    $(card).find('.progress').addClass("d-flex");
    sizeCache = sizeCache.filter(item => item[0] !== identifier)
    if(unexpected) {
        $(card).find('.options, .info, .open').addClass("d-none").removeClass("d-flex");
        $(card).find('.error').addClass('d-flex').removeClass("d-none");
        $(card).find('.report').unbind().on('click', () => {
            window.main.invoke("errorReport", {identifier: identifier, type: $(card).find('.custom-select.download-type').val(), quality: $(card).find('.custom-select.download-quality').val()}).then((id) => {
                $(card).find('.progress small').html("Error reported! Report ID: " + id);
                $(card).find('.report').prop("disabled", true);
            });
        });
        $(card).find('#fullError').unbind().on('click', () => {
            window.main.invoke("messageBox", {title: "Full error message", message: description});
        })
    } else {
        $(card).find('.options, .open').addClass("d-none").removeClass("d-flex");
        $(card).find('.info').addClass('d-flex').removeClass("d-none");
        $(card).find('.metadata.info').removeClass("d-none").html(description);
    }
}

function convertBytes(bytes) {
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let l = 0, n = parseInt(bytes, 10) || 0;
    while(n >= 1024 && ++l){
        n = n/1024;
    }
    return(n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
}

function getCard(identifier) {
    let card;
    $('.video-cards').children().each(function() {
        if($(this).prop('id') === identifier) {
            card = this;
            return false;
        }
    })
    return card;
}
