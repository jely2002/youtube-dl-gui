use crate::stronghold::state::StrongholdTauriState;
use tauri::State;

#[derive(serde::Serialize)]
pub struct VaultStatus {
  pub unlocked: bool,
  pub init_error: Option<String>,
}

#[tauri::command]
pub async fn stronghold_status(
  state: State<'_, StrongholdTauriState>,
) -> Result<VaultStatus, String> {
  let unlocked = state.secrets.is_unlocked();
  let init_error = state.init_error.lock().unwrap().clone();
  Ok(VaultStatus {
    unlocked,
    init_error,
  })
}
