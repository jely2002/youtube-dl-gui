use std::{path::PathBuf, sync::Mutex};
use tauri_plugin_stronghold::stronghold::Stronghold;

pub struct StrongholdVaultState {
  pub snapshot_path: PathBuf,
  pub inner: Mutex<Option<Stronghold>>,
  pub init_error: Mutex<Option<String>>,
}

impl StrongholdVaultState {
  pub fn new(snapshot_path: PathBuf) -> Self {
    Self {
      snapshot_path,
      inner: Mutex::new(None),
      init_error: Mutex::new(None),
    }
  }
}
