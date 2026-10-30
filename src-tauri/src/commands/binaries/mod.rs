pub mod binaries_check;
pub mod binaries_ensure;

pub use binaries_check::*;
pub use binaries_ensure::*;

#[tauri::command]
pub async fn binaries_status(
  manager: tauri::State<'_, crate::binaries::binaries_manager::BinariesManager>,
) -> Result<Vec<crate::binaries::resolver::DependencyReport>, String> {
  manager.status().await.map_err(|e| e.to_string())
}
