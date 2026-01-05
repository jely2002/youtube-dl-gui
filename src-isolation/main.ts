const allowedCommands: Set<string> = new Set([
    'app_ready',
    'media_info',
    'media_size',
    'media_download',
    'media_fatal',
    'media_diagnostic',
    'navigate',
    'binaries_check',
    'binaries_ensure',
    'updater_check',
    'updater_download',
    'updater_install',
    'config_set',
    'config_get',
    'config_reset',
    'preferences_set',
    'preferences_get',
    'preferences_reset',
    'group_cancel',
    'logging_subscribe',
    'logging_unsubscribe',
    'stronghold_init',
    'stronghold_status',
    'stronghold_keys',
    'stronghold_get',
    'stronghold_set',
    'get_platform',
    'notify',
    'plugin:shell|open',
    'plugin:event|listen',
    'plugin:event|unlisten',
    'plugin:path|resolve_directory',
    'plugin:opener|open_url',
    'plugin:opener|open_path',
    'plugin:opener|reveal_item_in_dir',
    'plugin:clipboard-manager|read_text',
    'plugin:dialog|open',
    'plugin:webview|internal_toggle_devtools',
    'plugin:window|set_badge_count',
    'plugin:window|set_progress_bar',
    'plugin:window|request_user_attention',
]);

window.__TAURI_ISOLATION_HOOK__ = (payload) => {
    const { cmd } = payload
    if (!allowedCommands.has(cmd)) {
        console.warn(`Isolation blocked unknown command: ${cmd}`)
        throw new Error(`Unauthorized command: ${cmd}`)
    }
    return payload
}
