use crate::stronghold::stronghold_state::StrongholdState;
use tauri::State;

#[derive(serde::Serialize)]
pub struct VaultStatus {
  pub unlocked: bool,
  pub init_error: Option<String>,
}

#[tauri::command]
pub async fn stronghold_status(state: State<'_, StrongholdState>) -> Result<VaultStatus, String> {
  let unlocked = state.inner.lock().unwrap().is_some();
  let init_error = state.init_error.lock().unwrap().clone();
  Ok(VaultStatus {
    unlocked,
    init_error,
  })
}
