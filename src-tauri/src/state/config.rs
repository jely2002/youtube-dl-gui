use crate::commands::{register_shortcuts, unregister_shortcuts};
use crate::i18n::I18nManager;
use crate::state::config_models::Config;
use crate::state::json_handle::JsonStoreHandle;
use crate::state::json_state::JsonBackedState;
use crate::tray::{create_tray, destroy_tray};
use crate::{DownloadLimiter, FetchLimiter};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

impl JsonBackedState for Config {
  const STORE_FILE: &'static str = "config.store.json";
  const ROOT_KEY: &'static str = "config";

  fn default_value() -> Self {
    Config::default()
  }

  fn before_initialized(app: &AppHandle<Wry>, value: &mut Self) {
    if value.network.enable_proxy.is_none() {
      value.network.enable_proxy =
        Some(value.network.proxy.as_ref().is_some_and(|v| !v.is_empty()));
    }
    if value.output.download_dir.is_none() {
      let download_path = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| std::env::current_dir().expect("couldn’t get current dir"));
      value.output.download_dir = Some(download_path.to_str().unwrap().to_string());
    }
  }

  fn on_updated(app: &AppHandle<Wry>, new_value: &Self) {
    if let Some(limiter) = app.try_state::<DownloadLimiter>() {
      let limiter = limiter.0.clone();
      let max = new_value.performance.max_concurrency;
      tauri::async_runtime::spawn(async move {
        limiter.resize(max).await;
      });
    }
    if let Some(limiter) = app.try_state::<FetchLimiter>() {
      let limiter = limiter.0.clone();
      let max = new_value.performance.max_concurrency;
      tauri::async_runtime::spawn(async move {
        limiter.resize(max).await;
      });
    }

    if new_value.input.global_shortcuts {
      register_shortcuts(app);
    } else {
      unregister_shortcuts(app);
    }

    if new_value.system.tray_enabled {
      create_tray(app);
    } else {
      destroy_tray(app);
    }

    if new_value.appearance.language == "system" {
      let i18n_handle = app.state::<I18nManager>();
      i18n_handle.unset_locale();
      if new_value.system.tray_enabled {
        destroy_tray(app);
        create_tray(app);
      }
    } else {
      let i18n_handle = app.state::<I18nManager>();
      i18n_handle.set_locale(&new_value.appearance.language);
      if new_value.system.tray_enabled {
        destroy_tray(app);
        create_tray(app);
      }
    }

    if new_value.system.auto_start_enabled {
      let _ = app.autolaunch().enable();
    } else {
      let _ = app.autolaunch().disable();
    }
  }
}

pub type ConfigHandle = JsonStoreHandle<Config>;
