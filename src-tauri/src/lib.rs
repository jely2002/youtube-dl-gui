mod binaries;
mod commands;
mod config;
mod logging;
mod menu;
mod models;
mod parsers;
mod paths;
mod runners;
mod scheduling;
mod stronghold;

use crate::binaries::binaries_manager::BinariesManager;
use crate::binaries::binaries_state::BinariesState;
use crate::commands::*;
use crate::logging::LogStoreState;
use crate::menu::setup_menu;
use crate::paths::PathsManager;
use crate::scheduling::download_pipeline::{setup_download_dispatcher, DownloadSender};
use crate::scheduling::fetch_pipeline::{setup_fetch_dispatcher, FetchSender};
use config::ConfigHandle;
use sentry::ClientInitGuard;
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex as StdMutex};
use stronghold::stronghold_state;
use tauri::Manager;
use tokio::sync::Mutex;
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::{fmt, prelude::*};

type SharedConfig = Arc<ConfigHandle>;

pub static RUNNING_GROUPS: LazyLock<StdMutex<HashMap<String, bool>>> =
  LazyLock::new(|| StdMutex::new(HashMap::new()));

/// # Panics
///
/// Will panic if an error occurs during tauri setup.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_keyring::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_clipboard_manager::init())
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
      let shared = Arc::new(config_handle);
      handle.manage::<SharedConfig>(shared);

      // manage update store
      handle.manage(Mutex::new(UpdateStore::default()));

      // manage log store
      handle.manage(LogStoreState::new());

      // setup dispatchers
      let fetch_dispatcher = setup_fetch_dispatcher(handle);
      handle.manage(FetchSender(fetch_dispatcher.sender()));
      let download_dispatcher = setup_download_dispatcher(handle);
      handle.manage(DownloadSender(download_dispatcher.sender()));

      // setup binaries
      handle.manage(BinariesState::default());
      handle.manage(BinariesManager::new(handle));

      // setup stronghold
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
      register_shortcuts(handle).expect("failed to register shortcuts");

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
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

pub fn init_tracing() {
  let fmt_layer = fmt::layer().with_filter(
    Targets::new()
      .with_target("tauri_plugin_updater", LevelFilter::OFF)
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

#[cfg(debug_assertions)]
const fn tracing_levels() -> LevelFilter {
  LevelFilter::DEBUG
}

#[cfg(not(debug_assertions))]
fn tracing_levels() -> LevelFilter {
  LevelFilter::INFO
}
