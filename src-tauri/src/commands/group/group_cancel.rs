use crate::logging::LogStoreState;
use crate::scheduling::group_state::cancel_group;
use tauri::State;

#[tauri::command]
pub fn group_cancel(group_id: String, log_state: State<'_, LogStoreState>) {
  cancel_group(&group_id);

  let mut store = log_state.write();
  store.remove_group(&group_id);
}
