use std::io;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::{Result, Update};
use tokio::sync::Mutex;

#[derive(serde::Serialize, Clone)]
pub struct UpdateProgress {
  pub received: usize,
  pub total: Option<u64>,
}

#[derive(Default)]
pub struct UpdateStore {
  pub update: Option<Update>,
  pub bytes: Option<Vec<u8>>,
}

#[tauri::command]
pub async fn updater_download(app: AppHandle, store: State<'_, Mutex<UpdateStore>>) -> Result<()> {
  let update = {
    let s = store.lock().await;
    s.update
      .clone()
      .ok_or_else(|| io::Error::other("no update available"))?
  };
  let app_for_progress = app.clone();
  let app_for_error = app.clone();

  let mut received: usize = 0;
  tracing::info!("[updater] Downloading update: {}", update.version);
  let bytes = update
    .download(
      move |chunk_len, content_len| {
        received += chunk_len;
        let _ = app_for_progress.emit(
          "updater_download_progress",
          UpdateProgress {
            total: content_len,
            received,
          },
        );
      },
      move || {
        tracing::info!("[updater] Update download complete.");
      },
    )
    .await;

  match bytes {
    Ok(bytes) => {
      let mut s = store.lock().await;
      s.bytes = Some(bytes);
      Ok(())
    }
    Err(e) => {
      tracing::info!("[updater] Update download failed: {e}");
      let _ = app_for_error.emit("updater_error", e.to_string());
      Err(e)
    }
  }
}
