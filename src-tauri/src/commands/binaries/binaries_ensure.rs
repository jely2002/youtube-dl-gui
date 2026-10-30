use crate::binaries::binaries_manager::BinariesManager;
use tauri::State;

#[tauri::command]
pub async fn binaries_ensure(
  binaries_manager: State<'_, BinariesManager>,
  tools: Option<Vec<String>>,
) -> Result<(), String> {
  match tools.as_ref() {
    Some(v) => binaries_manager.ensure(Some(v)).await,
    None => binaries_manager.ensure(None).await,
  }
  .map_err(|e| e.to_string())
}
