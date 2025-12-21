use crate::state::preferences_models::Preferences;
use crate::SharedPreferences;
use tauri::State;

#[tauri::command]
pub fn preferences_get(pref: State<'_, SharedPreferences>) -> Preferences {
  pref.load().as_ref().clone()
}
