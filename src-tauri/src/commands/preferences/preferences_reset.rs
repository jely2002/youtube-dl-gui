use crate::state::preferences_models::Preferences;
use crate::SharedPreferences;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn preferences_reset(
  app: AppHandle,
  pref: State<'_, SharedPreferences>,
) -> Result<Preferences, String> {
  pref.reset(&app).map_err(|e| e.to_string())
}
