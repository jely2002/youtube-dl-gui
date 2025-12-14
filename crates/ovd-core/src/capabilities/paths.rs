use std::path::PathBuf;

const PORTABLE_DIR: &str = "ovd-portable";
const BIN_DIR: &str = "bin";

pub trait AppPaths: Send + Sync + 'static {
  fn app_data_dir(&self) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>>;
  fn app_download_dir(&self) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>>;
}

#[derive(Clone)]
pub struct PathsManager {
  is_microsoft_store_app: bool,
  is_portable_app: bool,
  app_dir: PathBuf,
  pub(crate) download_dir: PathBuf,
  bin_dir: PathBuf,
}

impl PathsManager {
  pub fn new(paths: &dyn AppPaths) -> Self {
    let (app_dir, is_portable_app) = Self::resolve_app_dir(paths);
    let (bin_dir, is_microsoft_store_app) = Self::resolve_bin_dir(app_dir.clone());
    let download_dir = Self::resolve_download_dir(paths);

    Self {
      is_microsoft_store_app,
      is_portable_app,
      app_dir,
      download_dir,
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

  fn resolve_app_dir(paths: &dyn AppPaths) -> (PathBuf, bool) {
    if let Some(exe_dir) = Self::resolve_executable_path() {
      let portable_dir = exe_dir.join(PORTABLE_DIR);
      if portable_dir.exists() {
        return (portable_dir, true);
      }
    }

    (
      paths
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().expect("couldn’t get current dir")),
      false,
    )
  }

  fn resolve_download_dir(paths: &dyn AppPaths) -> PathBuf {
    paths
      .app_download_dir()
      .unwrap_or_else(|_| std::env::current_dir().expect("couldn’t get current dir"))
  }

  fn resolve_executable_path() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;
    Some(exe_dir.to_path_buf())
  }
}
