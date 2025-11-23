use crate::binaries::binaries_manager::BinariesManager;
use crate::binaries::binaries_state::CheckResult;
use tauri::{AppHandle, Wry};

#[tauri::command]
pub async fn binaries_check(app: AppHandle<Wry>) -> Result<CheckResult, String> {
  let mgr = BinariesManager::new(app);
  mgr.check().await.map_err(|e| e.to_string())
}
