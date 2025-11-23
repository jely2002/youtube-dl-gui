use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Default)]
pub struct BinariesState {
  running: AtomicBool,
}

impl BinariesState {
  pub(crate) fn try_start(&self) -> bool {
    self
      .running
      .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
      .is_ok()
  }
  pub(crate) fn finish(&self) {
    self.running.store(false, Ordering::SeqCst);
  }
}

#[derive(Serialize)]
pub struct CheckResult {
  pub tools: Vec<String>,
}
