use crate::stronghold::state::StrongholdTauriState;
use tauri::State;

#[tauri::command]
pub async fn stronghold_keys(
  state: State<'_, StrongholdTauriState>,
) -> Result<Vec<Vec<u8>>, String> {
  state.secrets.keys()
}
