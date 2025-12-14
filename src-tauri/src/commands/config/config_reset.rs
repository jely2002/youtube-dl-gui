use crate::SharedConfig;
use ovd_core::config::Config;
use tauri::State;

#[tauri::command]
pub fn config_reset(cfg: State<'_, SharedConfig>) -> Result<Config, String> {
  cfg.reset().map_err(|e| e.to_string())
}
