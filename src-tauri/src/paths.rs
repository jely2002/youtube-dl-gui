use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const PORTABLE_DIR: &str = "ovd-portable";
const BIN_DIR: &str = "bin";

#[derive(Clone)]
pub struct PathsManager {
  is_microsoft_store_app: bool,
  is_portable_app: bool,
  app_dir: PathBuf,
  bin_dir: PathBuf,
}

impl PathsManager {
  pub fn new(app: &AppHandle) -> Self {
    let (app_dir, is_portable_app) = Self::resolve_app_dir(app);
    let (bin_dir, is_microsoft_store_app) = Self::resolve_bin_dir(app_dir.clone());

    Self {
      is_microsoft_store_app,
      is_portable_app,
      app_dir,
      bin_dir,
    }
  }

  pub fn is_microsoft_store_app(&self) -> bool {
    self.is_microsoft_store_app
  }

  pub fn is_portable_app(&self) -> bool {
    self.is_portable_app
  }

  pub fn app_dir(&self) -> &PathBuf {
    &self.app_dir
  }

  pub fn bin_dir(&self) -> &PathBuf {
    &self.bin_dir
  }

  fn resolve_bin_dir(app_dir: PathBuf) -> (PathBuf, bool) {
    if let Some(exe_dir) = Self::resolve_executable_path() {
      let bin_dir = exe_dir.join(BIN_DIR);
      if bin_dir.exists() {
        return (bin_dir, true);
      }
    }

    (app_dir.join(BIN_DIR), false)
  }

  fn resolve_app_dir(app: &AppHandle) -> (PathBuf, bool) {
    if let Some(exe_dir) = Self::resolve_executable_path() {
      let portable_dir = exe_dir.join(PORTABLE_DIR);
      if portable_dir.exists() {
        return (portable_dir, true);
      }
    }

    (
      app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir"),
      false,
    )
  }

  fn resolve_executable_path() -> Option<PathBuf> {
    if let Ok(exe_path) = std::env::current_exe() {
      if let Some(exe_dir) = exe_path.parent() {
        return Some(exe_dir.to_path_buf());
      }
    }

    None
  }
}
