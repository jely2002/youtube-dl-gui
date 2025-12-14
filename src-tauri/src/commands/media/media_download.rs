use ovd_core::models::DownloadItem;
use ovd_core::scheduling::dispatcher::DispatchRequest;
use ovd_core::scheduling::download_pipeline::{DownloadRequest, DownloadSender};
use ovd_core::RUNNING_GROUPS;
use tauri::State;

#[tauri::command]
pub fn media_download(
  group_id: String,
  items: Vec<DownloadItem>,
  pipeline: State<'_, DownloadSender>,
) -> String {
  RUNNING_GROUPS
    .lock()
    .unwrap()
    .insert(group_id.clone(), true);

  pipeline
    .0
    .send(DispatchRequest::Pipeline(DownloadRequest::Batch {
      group_id: group_id.clone(),
      items,
    }))
    .unwrap();

  group_id
}
