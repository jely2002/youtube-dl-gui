use ovd_core::logging::LogStoreState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn logging_unsubscribe(
  group_id: String,
  log_state: State<'_, Arc<LogStoreState>>,
) -> Result<(), String> {
  let mut store = log_state.write();
  store.unsubscribe(&group_id);
  Ok(())
}
