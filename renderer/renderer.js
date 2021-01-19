let platform;

init();

async function init() {
    //Get platform
    platform = await window.main.invoke('platform');

    //Initialize titlebar
    if(platform === "darwin") {
        new windowbar({'style':'mac', 'dblClickable':false, 'fixed':true, 'title':document.title,'dark':true})
            .appendTo(document.body)
        $('.windowbar-title').css("left", "50%")
        $('.windowbar-controls').css("display","none")
    } else {
        new windowbar({'style':'win', 'dblClickable':false, 'fixed':true, 'title':document.title,'dark':true})
            .appendTo(document.body)
        $('.windowbar').prepend("<img src='../resources/assets/icon-titlebar-dark.png' alt='youtube-dl-gui icon' class='windowbar-icon'>")
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

    //Configures the 4 error toasts
    $('#error, #warning, #connection, #update').toast({
        autohide: false,
        animation: true
    })

    $('#add-url-btn').on('click', () => {
        if($('#url-form')[0].checkValidity()) {
            window.main.invoke('videoAction', { action: "entry", url: $('#add-url').val() });
            $('#url-form').trigger('reset');
        }
    });

    //Enables the main process to show logs/errors in the renderer dev console
    window.main.receive("log", (arg) => console.log(arg));

    //Enables the main process to show toasts.
    window.main.receive("toast", (arg) => showToast(arg))

    //Updates the windowbar icon when the app gets maximized/unmaximized
    window.main.receive("maximized", (maximized) => {
        if(maximized) $('.windowbar').addClass("fullscreen");
        else $('.windowbar').removeClass("fullscreen");
    })

    window.main.receive("videoAction", (arg) => {
        switch(arg.action) {
            case "add":
                addVideo(arg);
                break;
            case "remove":
                $(getCard(arg.identifier)).remove();
                break;
            case "progress":
                updateProgress(arg);
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
            }
            node = node.parentNode;
        }
    });

}

function showToast(toastInfo) {
    if(toastInfo.type === "error" || toastInfo.type === "warning" || toastInfo.type === "update") {
        if(toastInfo.title != null) {
            $(`.${toastInfo.type}-title`).html(toastInfo.title);
        }
        $(`.${toastInfo.type}-body`).html(toastInfo.msg);
        $(`#${toastInfo.type}`).toast('show').css('visibility', 'visible');
    } else if(toastInfo.type === "connection") {
        $(`#${toastInfo.type}`).toast('show').css('visibility', 'visible');
    } else {
        console.error("Main tried to show a toast that doesn't exist.")
    }
}

//TODO add loader when thumbnail is loading OR wait for the thumbnail to be loaded before making the new video visible.
function addVideo(args) {
    let template = $('.template.video-card').clone();
    $(template).removeClass('template');
    $(template).prop('id', args.identifier);

    if(args.type === "single") {
        $(template).find('.card-title')
            .html(args.title)
            .prop('title', args.title);
        $(template).find('img').prop("src", args.thumbnail);
        $(template).find('.info').addClass("d-none");
        $(template).find('.metadata.left').html('<strong>Duration: </strong>' + ((args.duration == null) ? "Unknown" : args.duration));
        if(args.formats[args.selected_format_index].filesize_label != null) {
            $(template).find('.metadata.right').html('<strong>Size: </strong>' + args.formats[args.selected_format_index].filesize_label);
        } else {
            //TODO connect event listener so the load button actually works
            $(template).find('.metadata.right').html('<strong>Size: </strong><button class="btn btn-dark">Load</button>');
        }
        for(const format of args.formats) {
            $(template).find('.custom-select.download-quality').append(new Option(format.display_name, format.display_name))
            if(args.formats.indexOf(format) === 0) $(template).find('.custom-select.download-quality').val(format.display_name).change();
        }
        $(template).find('.remove-btn').on('click', () => {
            $(getCard(args.identifier)).remove();
        })
        //TODO connect event listeners for the sidebuttons.


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
        $(template).find('.buttons').children().each(function() { $(this).addClass("disabled"); });

    } else if(args.type === "playlist") {
        $(template).find('.card-title')
            .html(args.url)
            .prop('title', args.url);
        $(template).find('.progress small')
            .html('0.00%')
        $(template).find('.progress').addClass("d-flex");
        $(template).find('.options').addClass("d-none");
        $(template).find('.metadata.info').html('Fetching video metadata...');
        $(template).find('.buttons').children().each(function() { $(this).addClass("disabled"); });
    }
    $('.video-cards').append(template);
}

function updateProgress(args) {
    let card = getCard(args.identifier);
    $(card).find('.progress-bar')
        .width(args.percentage)
        .prop("aria-valuenow", args.percentage.slice(0, -1));
    $(card).find('.progress small').html(`${args.percentage} - ${args.done} of ${args.total} `);

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
