use crate::config::Config;
use crate::SharedConfig;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn config_set(cfg: State<'_, SharedConfig>, patch: Value) -> Result<Config, String> {
  cfg.apply_patch(&patch).map_err(|e| e.to_string())
}
