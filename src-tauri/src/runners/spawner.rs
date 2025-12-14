use ovd_core::capabilities::{BoxFut, Spawner};

#[derive(Clone)]
pub struct TauriSpawner;

impl Spawner for TauriSpawner {
  fn spawn(&self, fut: BoxFut<()>) {
    tauri::async_runtime::spawn(fut);
  }
}
