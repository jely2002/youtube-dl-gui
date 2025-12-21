use crate::config::Config;
use crate::SharedConfig;
use serde_json::Value;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn config_set(
  app: AppHandle,
  cfg: State<'_, SharedConfig>,
  patch: Value,
) -> Result<Config, String> {
  cfg.apply_patch(&patch, &app).map_err(|e| e.to_string())
}
