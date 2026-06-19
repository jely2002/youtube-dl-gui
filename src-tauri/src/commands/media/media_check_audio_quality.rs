use crate::audio_quality::{analyze_audio_file, AudioQualityResult};
use std::path::PathBuf;

#[tauri::command]
pub async fn media_check_audio_quality(path: String) -> Result<AudioQualityResult, String> {
  tauri::async_runtime::spawn_blocking(move || analyze_audio_file(&PathBuf::from(path)))
    .await
    .map_err(|e| e.to_string())?
}
