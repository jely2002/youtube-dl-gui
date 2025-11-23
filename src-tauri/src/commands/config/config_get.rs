use crate::config::Config;
use crate::SharedConfig;
use tauri::State;

#[tauri::command]
pub fn config_get(cfg: State<'_, SharedConfig>) -> Config {
  cfg.load().as_ref().clone()
}
