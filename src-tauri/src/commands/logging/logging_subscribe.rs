use ovd_core::logging::LogStoreState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn logging_subscribe(
  group_id: String,
  log_state: State<'_, Arc<LogStoreState>>,
) -> Result<String, String> {
  let mut store = log_state.write();
  store.subscribe(group_id.clone());

  Ok(store.get_log(&group_id).unwrap_or_default())
}
