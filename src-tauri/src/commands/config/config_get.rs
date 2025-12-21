use crate::state::config_models::Config;
use crate::SharedConfig;
use tauri::State;

#[tauri::command]
pub fn config_get(cfg: State<'_, SharedConfig>) -> Config {
  cfg.load().as_ref().clone()
}
