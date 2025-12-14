mod commands;
mod config;
mod events;
mod menu;
mod paths;
mod runners;
mod stronghold;

use crate::commands::*;
use crate::config::{HandleConfigProvider, TauriJsonStore};
use crate::events::TauriEventSink;
use crate::menu::setup_menu;
use crate::paths::TauriAppPaths;
use crate::runners::{TauriProcessRunner, TauriSpawner};
use crate::stronghold::secrets_store::{KeyringMasterKeyProvider, StrongholdSecretsStore};
use crate::stronghold::state::StrongholdTauriState;
use crate::stronghold::vault::StrongholdVaultState;
use ovd_core::binaries::binaries_manager::BinariesManager;
use ovd_core::binaries::binaries_state::BinariesState;
use ovd_core::capabilities::{
  CoreCtx, DynConfigProvider, DynEventSink, DynProcessRunner, DynSecretsStore, PathsManager,
  Spawner,
};
use ovd_core::config::ConfigHandle;
use ovd_core::logging::LogStoreState;
use ovd_core::scheduling::download_pipeline::{setup_download_dispatcher, DownloadSender};
use ovd_core::scheduling::fetch_pipeline::{setup_fetch_dispatcher, FetchSender};
use sentry::ClientInitGuard;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::{fmt, prelude::*};

type SharedConfig = Arc<ConfigHandle<TauriJsonStore>>;

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
    .setup(|app| {
      let handle = app.handle();

      init_tracing();

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

      let events: DynEventSink = Arc::new(TauriEventSink::new(handle.clone()));

      let spawner: Arc<dyn Spawner> = Arc::new(TauriSpawner);
      let process: DynProcessRunner = Arc::new(TauriProcessRunner::new(handle.clone()));

      let paths = PathsManager::new(&TauriAppPaths::new(handle.clone()));
      handle.manage(paths.clone());

      let logging: Arc<LogStoreState> = Arc::new(LogStoreState::new());
      handle.manage(logging.clone());

      let store_path = paths.app_dir().join("config.store.json");
      let json_store = Arc::new(TauriJsonStore::open(handle, store_path)?);
      let cfg_handle: SharedConfig = Arc::new(ConfigHandle::init(json_store)?);
      let config: DynConfigProvider = Arc::new(HandleConfigProvider::new(cfg_handle.clone()));
      handle.manage(cfg_handle.clone());

      let snapshot_path = paths.app_dir().join("vault.hold");
      let vault = Arc::new(StrongholdVaultState::new(snapshot_path.clone()));
      let key_provider = KeyringMasterKeyProvider::new(handle.clone());

      let secrets: DynSecretsStore = Arc::new(StrongholdSecretsStore::new(vault, key_provider));
      app.manage(StrongholdTauriState::new(secrets.clone()));

      // async init stronghold
      #[cfg(not(all(target_os = "macos", debug_assertions)))]
      {
        let _ = secrets.init_or_unlock();
      }

      let core_ctx = CoreCtx {
        events,
        config,
        process,
        spawner,
        secrets,
        paths,
        logging,
      };

      handle.manage(core_ctx.clone());

      handle.manage(Mutex::new(UpdateStore::default()));

      handle.manage(BinariesState::default());
      handle.manage(BinariesManager::new(&core_ctx));

      let fetch_dispatcher = setup_fetch_dispatcher(&core_ctx);
      handle.manage(FetchSender(fetch_dispatcher.sender()));

      let download_dispatcher = setup_download_dispatcher(&core_ctx);
      handle.manage(DownloadSender(download_dispatcher.sender()));

      setup_menu(handle);

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
