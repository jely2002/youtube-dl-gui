use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn app_ready(app: AppHandle) {
  app.get_webview_window("main").unwrap().show().unwrap();
  #[cfg(target_os = "macos")]
  {
    app.get_webview_window("main").unwrap().set_focus().unwrap();
  }
}
