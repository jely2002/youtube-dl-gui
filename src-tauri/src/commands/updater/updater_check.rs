use crate::commands::UpdateStore;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Result as UpdaterResult, UpdaterExt};
use tokio::sync::Mutex;

#[derive(serde::Serialize)]
pub struct UpdateCheck {
  pub available: bool,
  pub current_version: String,
  pub available_version: Option<String>,
}

#[tauri::command]
pub async fn updater_check(
  app: AppHandle,
  store: State<'_, Mutex<UpdateStore>>,
) -> UpdaterResult<UpdateCheck> {
  let current = app.package_info().version.to_string();
  if let Some(update) = app.updater()?.check().await? {
    tracing::info!("[updater] Update available: {}", update.version);
    let mut s = store.lock().await;
    s.bytes = None;
    s.update = Some(update.clone());
    Ok(UpdateCheck {
      available: true,
      current_version: current,
      available_version: Some(update.version),
    })
  } else {
    Ok(UpdateCheck {
      available: false,
      current_version: current,
      available_version: None,
    })
  }
}
