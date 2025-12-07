use crate::binaries::binaries_manager::BinariesManager;
use crate::binaries::binaries_state::CheckResult;
use tauri::State;

#[tauri::command]
pub async fn binaries_check(
  binaries_manager: State<'_, BinariesManager>,
) -> Result<CheckResult, String> {
  binaries_manager.check().await.map_err(|e| e.to_string())
}
