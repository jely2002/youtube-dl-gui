#[tauri::command]
pub fn get_platform() -> &'static str {
  if cfg!(target_os = "windows") {
    "windows"
  } else if cfg!(target_os = "macos") {
    "macos"
  } else if cfg!(target_os = "linux") {
    "linux"
  } else {
    "unknown"
  }
}
