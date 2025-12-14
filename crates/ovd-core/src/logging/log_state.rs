use crate::logging::LogStore;
use std::sync::RwLock;

pub struct LogStoreState {
  inner: RwLock<LogStore>,
}

impl Default for LogStoreState {
  fn default() -> Self {
    Self::new()
  }
}

impl LogStoreState {
  const MAX_LOG_BYTES: usize = 8 * 1024 * 1024;

  pub fn new() -> Self {
    Self {
      inner: RwLock::new(LogStore::new(LogStoreState::MAX_LOG_BYTES)),
    }
  }

  pub fn write(&self) -> std::sync::RwLockWriteGuard<'_, LogStore> {
    self.inner.write().unwrap()
  }
}
