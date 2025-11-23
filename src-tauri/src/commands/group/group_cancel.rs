use crate::logging::LogStoreState;
use crate::RUNNING_GROUPS;
use tauri::State;

#[tauri::command]
pub fn group_cancel(group_id: String, log_state: State<'_, LogStoreState>) {
  let mut map = RUNNING_GROUPS.lock().unwrap();
  map.insert(group_id.clone(), false);

  let mut store = log_state.write();
  store.remove_group(&group_id);
}
