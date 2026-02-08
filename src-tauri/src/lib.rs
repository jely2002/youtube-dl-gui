mod binaries;
mod commands;
mod i18n;
mod logging;
mod menu;
mod models;
mod parsers;
mod paths;
mod runners;
mod scheduling;
mod state;
mod stronghold;
mod tray;
mod window;

use crate::binaries::binaries_manager::BinariesManager;
use crate::binaries::binaries_state::BinariesState;
use crate::commands::*;
use crate::i18n::I18nManager;
use crate::logging::LogStoreState;
use crate::menu::setup_menu;
use crate::paths::PathsManager;
use crate::scheduling::concurrency::DynamicSemaphore;
use crate::scheduling::download_pipeline::{setup_download_dispatcher, DownloadSender};
use crate::scheduling::fetch_pipeline::{setup_fetch_dispatcher, FetchSender};
use crate::state::config::ConfigHandle;
use crate::state::preferences::PreferencesHandle;
use crate::tray::{create_tray, TrayState};
use crate::window::{restore_main_window, setup_close_behaviour, track_main_window};
use sentry::ClientInitGuard;
use std::sync::{Arc, Mutex as StdMutex};
use stronghold::stronghold_state;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tokio::sync::Mutex;
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::{fmt, prelude::*};

type SharedConfig = Arc<ConfigHandle>;
type SharedPreferences = Arc<PreferencesHandle>;

#[derive(Clone)]
pub struct DownloadLimiter(pub Arc<DynamicSemaphore>);

#[derive(Clone)]
pub struct FetchLimiter(pub Arc<DynamicSemaphore>);

/// # Panics
///
/// Will panic if an error occurs during tauri setup.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_autostart::Builder::new().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_keyring::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(
      MacosLauncher::LaunchAgent,
      Some(vec!["--auto-start"]),
    ))
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      reopen_window(app)
    }))
    .setup(|app| {
      let handle = app.handle();

      let sentry_client = sentry::init((
        "https://e5ff83f3c84f397db516955ec278c4c6@o762792.ingest.us.sentry.io/4510256640884736",
        sentry::ClientOptions {
          traces_sample_rate: 0.05,
          sample_rate: 0.25,
          release: sentry::release_name!(),
          ..sentry::ClientOptions::default()
        },
      ));
      handle.manage::<ClientInitGuard>(sentry_client);

      init_tracing();

      // setup runtime mode detection / path management
      let path_handle = PathsManager::new(handle);
      handle.manage(path_handle.clone());

      // setup config management
      let config_handle = ConfigHandle::init(handle)?;
      let shared_config = Arc::new(config_handle);
      handle.manage::<SharedConfig>(shared_config);

      let preferences_handle = PreferencesHandle::init(handle)?;
      let shared_preferences = Arc::new(preferences_handle);
      handle.manage::<SharedPreferences>(shared_preferences);

      // setup i18n management
      handle.manage(I18nManager::new(handle));

      // setup window management
      restore_main_window(handle);
      track_main_window(handle);
      setup_close_behaviour(handle);

      // setup tray
      handle.manage(TrayState {
        tray: StdMutex::new(None),
      });
      create_tray(handle);

      // setup autostart
      init_autostart(handle);

      // manage update store
      handle.manage(Mutex::new(UpdateStore::default()));

      // manage log store
      handle.manage(LogStoreState::new());

      // setup dispatchers
      let cfg_snapshot = handle.state::<SharedConfig>().load();
      let max_concurrency = cfg_snapshot.performance.max_concurrency;
      let download_limiter = Arc::new(DynamicSemaphore::new(max_concurrency));
      let fetch_limiter = Arc::new(DynamicSemaphore::new(max_concurrency));
      handle.manage(DownloadLimiter(download_limiter.clone()));
      handle.manage(FetchLimiter(fetch_limiter.clone()));

      let fetch_dispatcher = setup_fetch_dispatcher(handle, fetch_limiter);
      handle.manage(FetchSender(fetch_dispatcher.sender()));
      let download_dispatcher = setup_download_dispatcher(handle, download_limiter);
      handle.manage(DownloadSender(download_dispatcher.sender()));

      // setup binaries
      handle.manage(BinariesState::default());
      handle.manage(BinariesManager::new(handle));

      // set up stronghold
      let app_path = path_handle.app_dir();
      let stronghold_path = app_path.join("vault.hold");

      handle.manage(stronghold_state::StrongholdState::new(stronghold_path));

      // async init stronghold
      #[cfg(not(all(target_os = "macos", debug_assertions)))]
      {
        let state_ref = handle.state::<stronghold_state::StrongholdState>();
        stronghold_state::init_on_startup(handle, &state_ref);
      }

      // configure app menu
      setup_menu(handle);

      // register shortcuts
      register_shortcuts(handle);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      app_ready,
      media_size,
      media_info,
      media_download,
      group_cancel,
      logging_subscribe,
      logging_unsubscribe,
      config_get,
      config_reset,
      config_set,
      preferences_get,
      preferences_reset,
      preferences_set,
      binaries_check,
      binaries_ensure,
      updater_check,
      updater_download,
      updater_install,
      stronghold_init,
      stronghold_status,
      stronghold_keys,
      stronghold_get,
      stronghold_set,
      get_platform,
      notify,
    ])
    .build(tauri::generate_context!())
    .expect("error while running tauri application");

  app.run(|_app_handle, _event| {
    #[cfg(target_os = "macos")]
    {
      if let tauri::RunEvent::Reopen {
        has_visible_windows,
        ..
      } = _event
      {
        if !has_visible_windows {
          reopen_window(_app_handle);
        }
      }
    }
  });
}

pub fn init_tracing() {
  let fmt_layer = fmt::layer().with_filter(
    Targets::new()
      .with_target("tauri_plugin_updater", LevelFilter::OFF)
      .with_target(
        "tao::platform_impl::platform::event_loop::runner",
        LevelFilter::OFF,
      )
      .with_default(tracing_levels()),
  );

  let sentry_layer = sentry::integrations::tracing::layer().with_filter(
    Targets::new()
      .with_target("tauri_plugin_updater", LevelFilter::OFF)
      .with_default(LevelFilter::TRACE),
  );

  tracing_subscriber::registry()
    .with(fmt_layer)
    .with(sentry_layer)
    .init();
}

pub fn init_autostart(app: &AppHandle) {
  let cfg_handle = app.state::<SharedConfig>();
  let cfg = cfg_handle.load();
  let autostart_manager = app.autolaunch();
  let is_enabled = autostart_manager.is_enabled().unwrap_or(false);

  if cfg.system.auto_start_enabled && !is_enabled {
    let _ = autostart_manager.enable();
  } else if !cfg.system.auto_start_enabled && is_enabled {
    let _ = autostart_manager.disable();
  }
}

pub fn reopen_window(app: &AppHandle) {
  let Some(window) = app.get_webview_window("main") else {
    return;
  };
  let _ = window.show();
  let _ = window.set_focus();
}

#[cfg(debug_assertions)]
const fn tracing_levels() -> LevelFilter {
  LevelFilter::DEBUG
}

#[cfg(not(debug_assertions))]
fn tracing_levels() -> LevelFilter {
  LevelFilter::INFO
}
