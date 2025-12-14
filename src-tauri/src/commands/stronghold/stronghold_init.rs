use crate::commands::VaultStatus;
use crate::stronghold::state::StrongholdTauriState;
use tauri::State;

#[tauri::command]
pub async fn stronghold_init(
  state: State<'_, StrongholdTauriState>,
) -> Result<VaultStatus, String> {
  if let Err(e) = state.secrets.init_new() {
    *state.init_error.lock().unwrap() = Some(format!("Vault initialize failed: {e}"));
  } else {
    *state.init_error.lock().unwrap() = None;
  }

  Ok(VaultStatus {
    unlocked: state.secrets.is_unlocked(),
    init_error: state.init_error.lock().unwrap().clone(),
  })
}
