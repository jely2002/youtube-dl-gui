use crate::binaries::binaries_manager::BinariesManager;
use crate::binaries::binaries_state::BinariesState;
use tauri::{AppHandle, State, Wry};

#[tauri::command]
pub async fn binaries_ensure(
  app: AppHandle<Wry>,
  state: State<'_, BinariesState>,
  tools: Option<Vec<String>>,
) -> Result<(), String> {
  if !state.try_start() {
    return Ok(());
  }
  let mgr = BinariesManager::new(app);
  let res = match tools.as_ref() {
    Some(v) => mgr.ensure(Some(v)).await,
    None => mgr.ensure(None).await,
  }
  .map_err(|e| e.to_string());
  state.finish();
  res
}
