use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const PORTABLE_DIR: &str = "ovd-portable";
const BIN_DIR: &str = "bin";
const SNAP_USER_DATA_ENV: &str = "SNAP_USER_DATA";
const SNAP_USER_COMMON_ENV: &str = "SNAP_USER_COMMON";

#[derive(Clone)]
pub struct PathsManager {
  is_microsoft_store_app: bool,
  is_portable_app: bool,
  is_snap_app: bool,
  app_dir: PathBuf,
  bin_dir: PathBuf,
}

impl PathsManager {
  pub fn new(app: &AppHandle) -> Self {
    let (app_dir, is_portable_app, is_snap_app) = Self::resolve_app_dir(app);
    let (bin_dir, is_microsoft_store_app) = Self::resolve_bin_dir(app_dir.clone());

    let mut environment_type = "installed";
    if is_microsoft_store_app {
      environment_type = "microsoft-store"
    }
    if is_portable_app {
      environment_type = "portable";
    }
    if is_snap_app {
      environment_type = "snap";
    }
    tracing::debug!("automatically detected environment: {}", environment_type);
    tracing::debug!(
      "automatically detected paths: app_dir={:?}, bin_dir={:?}",
      app_dir,
      bin_dir
    );
    if is_snap_app {
      if let Some(snap_user_data) = Self::resolve_snap_user_data_dir() {
        tracing::debug!(
          "snap environment detected: {}={:?}",
          SNAP_USER_DATA_ENV,
          snap_user_data
        );
      }
      if let Some(snap_user_common) = Self::resolve_snap_user_common_dir() {
        tracing::debug!(
          "snap environment detected: {}={:?}",
          SNAP_USER_COMMON_ENV,
          snap_user_common
        );
      }
    }

    Self {
      is_microsoft_store_app,
      is_portable_app,
      is_snap_app,
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

  pub fn is_snap_app(&self) -> bool {
    self.is_snap_app
  }

  pub fn app_dir(&self) -> &PathBuf {
    &self.app_dir
  }

  pub fn bin_dir(&self) -> &PathBuf {
    &self.bin_dir
  }

  fn resolve_bin_dir(app_dir: PathBuf) -> (PathBuf, bool) {
    Self::resolve_bin_dir_with(
      app_dir,
      Self::resolve_executable_path(),
      Self::resolve_snap_user_common_dir(),
    )
  }

  fn resolve_app_dir(app: &AppHandle) -> (PathBuf, bool, bool) {
    let app_data_dir = app
      .path()
      .app_data_dir()
      .expect("failed to resolve app data dir");
    Self::resolve_app_dir_with(
      &app.config().identifier,
      app_data_dir,
      Self::resolve_executable_path(),
      Self::resolve_snap_user_data_dir(),
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

  fn resolve_snap_user_common_dir() -> Option<PathBuf> {
    std::env::var(SNAP_USER_COMMON_ENV)
      .ok()
      .filter(|value| !value.is_empty())
      .map(PathBuf::from)
  }

  fn resolve_snap_user_data_dir() -> Option<PathBuf> {
    std::env::var(SNAP_USER_DATA_ENV)
      .ok()
      .filter(|value| !value.is_empty())
      .map(PathBuf::from)
  }

  fn resolve_app_dir_with(
    app_id: &str,
    app_data_dir: PathBuf,
    exe_dir: Option<PathBuf>,
    snap_user_data: Option<PathBuf>,
  ) -> (PathBuf, bool, bool) {
    if let Some(snap_dir) = snap_user_data {
      return (snap_dir.join(app_id), false, true);
    }
    if let Some(exe_dir) = exe_dir {
      let portable_dir = exe_dir.join(PORTABLE_DIR);
      if portable_dir.exists() {
        return (portable_dir, true, false);
      }
    }

    (app_data_dir, false, false)
  }

  fn resolve_bin_dir_with(
    app_dir: PathBuf,
    exe_dir: Option<PathBuf>,
    snap_user_common: Option<PathBuf>,
  ) -> (PathBuf, bool) {
    if let Some(exe_dir) = exe_dir {
      let bin_dir = exe_dir.join(BIN_DIR);
      if bin_dir.exists() {
        return (bin_dir, true);
      }
    }

    if let Some(snap_common_dir) = snap_user_common {
      return (snap_common_dir.join(BIN_DIR), false);
    }

    (app_dir.join(BIN_DIR), false)
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;

  fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ovd-{}-{}", prefix, uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).expect("failed to create temp dir");
    dir
  }

  #[test]
  fn resolve_app_dir_prefers_snap_user_data() {
    let base = temp_dir("snap-app-dir");
    let snap_user_data = base.join("snap-user-data");
    let app_data_dir = base.join("app-data");
    fs::create_dir_all(&snap_user_data).unwrap();
    fs::create_dir_all(&app_data_dir).unwrap();

    let (app_dir, is_portable, is_snap) = PathsManager::resolve_app_dir_with(
      "com.test.app",
      app_data_dir.clone(),
      None,
      Some(snap_user_data.clone()),
    );

    assert_eq!(app_dir, snap_user_data.join("com.test.app"));
    assert!(!is_portable);
    assert!(is_snap);
  }

  #[test]
  fn resolve_app_dir_uses_portable_when_present() {
    let base = temp_dir("portable-app-dir");
    let exe_dir = base.join("exe");
    let portable_dir = exe_dir.join(PORTABLE_DIR);
    let app_data_dir = base.join("app-data");
    fs::create_dir_all(&portable_dir).unwrap();
    fs::create_dir_all(&app_data_dir).unwrap();

    let (app_dir, is_portable, is_snap) =
      PathsManager::resolve_app_dir_with("com.test.app", app_data_dir, Some(exe_dir), None);

    assert_eq!(app_dir, portable_dir);
    assert!(is_portable);
    assert!(!is_snap);
  }

  #[test]
  fn resolve_app_dir_snap_overrides_portable() {
    let base = temp_dir("snap-over-portable");
    let snap_user_data = base.join("snap-user-data");
    let exe_dir = base.join("exe");
    let portable_dir = exe_dir.join(PORTABLE_DIR);
    let app_data_dir = base.join("app-data");
    fs::create_dir_all(&snap_user_data).unwrap();
    fs::create_dir_all(&portable_dir).unwrap();
    fs::create_dir_all(&app_data_dir).unwrap();

    let (app_dir, is_portable, is_snap) = PathsManager::resolve_app_dir_with(
      "com.test.app",
      app_data_dir,
      Some(exe_dir),
      Some(snap_user_data.clone()),
    );

    assert_eq!(app_dir, snap_user_data.join("com.test.app"));
    assert!(!is_portable);
    assert!(is_snap);
  }

  #[test]
  fn resolve_bin_dir_uses_snap_common_when_set() {
    let base = temp_dir("snap-bin-dir");
    let snap_user_common = base.join("snap-user-common");
    let app_dir = base.join("app");
    fs::create_dir_all(&snap_user_common).unwrap();
    fs::create_dir_all(&app_dir).unwrap();

    let (bin_dir, is_microsoft_store) =
      PathsManager::resolve_bin_dir_with(app_dir, None, Some(snap_user_common.clone()));

    assert_eq!(bin_dir, snap_user_common.join(BIN_DIR));
    assert!(!is_microsoft_store);
  }

  #[test]
  fn resolve_bin_dir_uses_exe_bin_for_microsoft_store() {
    let base = temp_dir("ms-bin-dir");
    let exe_dir = base.join("exe");
    let bin_dir = exe_dir.join(BIN_DIR);
    let app_dir = base.join("app");
    fs::create_dir_all(&bin_dir).unwrap();
    fs::create_dir_all(&app_dir).unwrap();

    let (resolved, is_microsoft_store) =
      PathsManager::resolve_bin_dir_with(app_dir, Some(exe_dir), None);

    assert_eq!(resolved, bin_dir);
    assert!(is_microsoft_store);
  }

  #[test]
  fn resolve_bin_dir_defaults_to_app_dir() {
    let base = temp_dir("default-bin-dir");
    let app_dir = base.join("app");
    fs::create_dir_all(&app_dir).unwrap();

    let (resolved, is_microsoft_store) =
      PathsManager::resolve_bin_dir_with(app_dir.clone(), None, None);

    assert_eq!(resolved, app_dir.join(BIN_DIR));
    assert!(!is_microsoft_store);
  }
}
