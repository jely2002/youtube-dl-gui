use ovd_core::capabilities::AppPaths;
use std::error::Error;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub struct TauriAppPaths {
  app: AppHandle,
}

impl TauriAppPaths {
  pub fn new(app: AppHandle) -> Self {
    Self { app }
  }
}

impl AppPaths for TauriAppPaths {
  fn app_data_dir(&self) -> Result<PathBuf, Box<dyn Error + Send + Sync>> {
    Ok(self.app.path().app_data_dir()?)
  }

  fn app_download_dir(&self) -> Result<PathBuf, Box<dyn Error + Send + Sync>> {
    Ok(self.app.path().download_dir()?)
  }
}
