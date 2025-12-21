use crate::state::preferences_models::Preferences;
use crate::SharedPreferences;
use serde_json::Value;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn preferences_set(
  app: AppHandle,
  pref: State<'_, SharedPreferences>,
  patch: Value,
) -> Result<Preferences, String> {
  pref.apply_patch(&patch, &app).map_err(|e| e.to_string())
}
