use crate::commands::VaultStatus;
use crate::stronghold::stronghold_state;
use crate::stronghold::stronghold_state::StrongholdState;
use tauri::{AppHandle, State, Wry};

#[tauri::command]
pub async fn stronghold_init(
  app: AppHandle<Wry>,
  state: State<'_, StrongholdState>,
) -> Result<VaultStatus, String> {
  if let Err(init_err) = stronghold_state::init(&app, &state) {
    *state.init_error.lock().unwrap() = Some(format!("Vault initialize failed: {init_err}"));
  }
  let unlocked = state.inner.lock().unwrap().is_some();
  let init_error = state.init_error.lock().unwrap().clone();
  Ok(VaultStatus {
    unlocked,
    init_error,
  })
}
