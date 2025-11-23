use crate::stronghold::stronghold_state::{StrongholdState, CLIENT};
use tauri::State;

#[tauri::command]
pub async fn stronghold_keys(state: State<'_, StrongholdState>) -> Result<Vec<Vec<u8>>, String> {
  let guard = state.inner.lock().unwrap();
  let sh = guard.as_ref().ok_or_else(|| "vault locked".to_string())?;
  let client = sh
    .get_client(CLIENT)
    .map_err(|e| format!("get_client failed: {e}"))?;
  let store = client.store();
  store.keys().map_err(|e| e.to_string())
}
