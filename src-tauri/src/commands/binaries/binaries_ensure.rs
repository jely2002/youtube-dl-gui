use crate::binaries::binaries_manager::BinariesManager;
use crate::binaries::binaries_state::BinariesState;
use tauri::State;

#[tauri::command]
pub async fn binaries_ensure(
  binaries_manager: State<'_, BinariesManager>,
  state: State<'_, BinariesState>,
  tools: Option<Vec<String>>,
) -> Result<(), String> {
  if !state.try_start() {
    return Ok(());
  }
  let res = match tools.as_ref() {
    Some(v) => binaries_manager.ensure(Some(v)).await,
    None => binaries_manager.ensure(None).await,
  }
  .map_err(|e| e.to_string());
  state.finish();
  res
}
