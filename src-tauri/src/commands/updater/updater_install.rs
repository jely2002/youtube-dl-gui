use crate::commands::UpdateStore;
use std::io;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::Result;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn updater_install(app: AppHandle, store: State<'_, Mutex<UpdateStore>>) -> Result<()> {
  let (update, bytes) = {
    let mut s = store.lock().await;

    let update = s
      .update
      .clone()
      .ok_or_else(|| io::Error::other("no update available"))?;

    let bytes = s
      .bytes
      .take()
      .ok_or_else(|| io::Error::other("no update downloaded"))?;

    (update, bytes)
  };

  update.install(&bytes)?;
  let _ = app.emit("updater_finished", ());
  Ok(())
}
