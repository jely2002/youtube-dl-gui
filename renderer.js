let platform;
let titlebar;


init();

async function init() {
    //Get platform
    platform = await window.main.invoke('platform');

    //Initialize titlebar
    if(platform === "darwin") {
        titlebar = new windowbar({'style':'mac', 'dblClickable':false, 'fixed':true, 'title':'YouTube Downloader','dark':true})
            .appendTo(document.body)
        $('.windowbar-title').css("left", "50%")
        $('.windowbar-controls').css("display","none")
    } else {
        titlebar = new windowbar({'style':'win', 'dblClickable':false, 'fixed':true, 'title':'YouTube Downloader','dark':true})
            .appendTo(document.body)
        $('.windowbar').prepend("<img src='web-resources/icon-light.png' alt='youtube-dl-gui icon' class='windowbar-icon'>")
        $('.windowbar-title').css("left", "45px")
    }
    $('.windowbar-minimize').on('click', (event) => {
        window.main.invoke('titlebarClick', "minimize")
    })
    $('.windowbar-close').on('click', (event) => {
        window.main.invoke('titlebarClick', "close")
    })
    $('.windowbar-maximize').on('click', (event) => {
        event.stopPropagation()
        event.stopImmediatePropagation()
        event.preventDefault()
        $('.windowbar').removeClass('fullscreen')
    })

    //Initialize stepper
    stepper = new Stepper($('.bs-stepper')[0], {
        linear: true,
        animation: true
    })

    //Configures the 4 error toasts
    $('#error').toast({
        autohide: false,
        animation: true
    })
    $('#warning').toast({
        autohide: false,
        animation: true
    })
    $('#connection').toast({
        autohide: false,
        animation: true
    })
    $('#update').toast({
        autohide: false,
        animation: true
    })

    //Enables the main process to show logs/errors in the renderer dev console
    window.main.receive("log", (arg) => console.log(arg));

    //Enables the main process to show toasts.
    window.main.receive("toast", (arg) => showToast(arg))

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
        console.error("Main.js tried to show a toast that doesn't exists.")
    }
}
