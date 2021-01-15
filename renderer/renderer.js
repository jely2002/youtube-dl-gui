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
        $('.windowbar').prepend("<img src='../resources/assets/icon-light.png' alt='youtube-dl-gui icon' class='windowbar-icon'>")
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

    //Enables the main process to show logs/errors in the renderer dev console
    window.main.receive("log", (arg) => console.log(arg));

    //Enables the main process to show toasts.
    window.main.receive("toast", (arg) => showToast(arg))

    window.main.receive("maximized", (maximized) => {
        if(maximized) $('.windowbar').addClass("fullscreen");
        else $('.windowbar').removeClass("fullscreen");
    })

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
