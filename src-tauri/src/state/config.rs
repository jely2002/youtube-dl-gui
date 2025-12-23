use std::error::Error;
use tauri::{AppHandle, Manager, Wry};

use crate::commands::{register_shortcuts, unregister_shortcuts};
use crate::state::config_models::Config;
use crate::state::json_handle::JsonStoreHandle;
use crate::state::json_state::JsonBackedState;

impl JsonBackedState for Config {
  const STORE_FILE: &'static str = "config.store.json";
  const ROOT_KEY: &'static str = "config";

  fn default_value() -> Self {
    Config::default()
  }

  fn before_initialized(app: &AppHandle<Wry>, value: &mut Self) -> Result<(), Box<dyn Error>> {
    if value.output.download_dir.is_none() {
      let download_path = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| std::env::current_dir().expect("couldn’t get current dir"));
      value.output.download_dir = Some(download_path.to_str().unwrap().to_string());
    }
    Ok(())
  }

  fn on_updated(app: &AppHandle<Wry>, new_value: &Self) -> Result<(), Box<dyn Error>> {
    if new_value.input.global_shortcuts {
      register_shortcuts(app)?;
    } else {
      unregister_shortcuts(app)?;
    }
    Ok(())
  }
}

pub type ConfigHandle = JsonStoreHandle<Config>;
