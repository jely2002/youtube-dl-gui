use crate::stronghold::stronghold_state::{StrongholdState, CLIENT};
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn stronghold_set(
  state: State<'_, StrongholdState>,
  entries: HashMap<String, Option<Vec<u8>>>,
) -> Result<(), String> {
  let guard = state.inner.lock().unwrap();
  let sh = guard.as_ref().ok_or_else(|| "vault locked".to_string())?;
  let client = sh
    .get_client(CLIENT)
    .map_err(|e| format!("get_client failed: {e}"))?;
  let store = client.store();

  for (key, maybe_value) in entries {
    match maybe_value {
      Some(value) => {
        store
          .insert(key.into_bytes(), value, None)
          .map_err(|e| e.to_string())?;
      }
      None => {
        store.delete(key.as_bytes()).map_err(|e| e.to_string())?;
      }
    }
  }

  sh.write_client(CLIENT)
    .map_err(|e| format!("write_client failed: {e}"))?;
  sh.save().map_err(|e| e.to_string())
}
