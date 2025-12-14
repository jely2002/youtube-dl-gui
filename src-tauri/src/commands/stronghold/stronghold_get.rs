use crate::stronghold::state::StrongholdTauriState;
use tauri::State;

#[tauri::command]
pub async fn stronghold_get(
  state: State<'_, StrongholdTauriState>,
  keys: Vec<String>,
) -> Result<std::collections::HashMap<String, Option<Vec<u8>>>, String> {
  state.secrets.get_many(&keys)
}
