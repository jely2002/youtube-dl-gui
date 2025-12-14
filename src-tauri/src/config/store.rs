use ovd_core::config::JsonStore;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Wry};
use tauri_plugin_store::{Store, StoreExt};

pub struct TauriJsonStore {
  store: Arc<Store<Wry>>,
}

impl TauriJsonStore {
  pub fn open(app: &AppHandle<Wry>, store_path: std::path::PathBuf) -> Result<Self, String> {
    let store = app.store(store_path).map_err(|e| e.to_string())?;
    Ok(Self { store })
  }
}

impl JsonStore for TauriJsonStore {
  fn get(&self, key: &str) -> Result<Option<Value>, String> {
    Ok(self.store.get(key))
  }

  fn set(&self, key: &str, value: Value) -> Result<(), String> {
    self.store.set(key, value);
    Ok(())
  }

  fn save(&self) -> Result<(), String> {
    self.store.save().map_err(|e| e.to_string())
  }
}
