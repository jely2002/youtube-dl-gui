use crate::stronghold::state::StrongholdTauriState;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn stronghold_set(
  state: State<'_, StrongholdTauriState>,
  entries: HashMap<String, Option<Vec<u8>>>,
) -> Result<(), String> {
  state.secrets.set_many(entries)
}
