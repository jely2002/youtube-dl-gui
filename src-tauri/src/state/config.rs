use std::error::Error;
use tauri::{AppHandle, Wry};

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
