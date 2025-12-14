use ovd_core::scheduling::dispatcher::DispatchRequest;
use ovd_core::scheduling::fetch_pipeline::{FetchRequest, FetchSender};
use ovd_core::RUNNING_GROUPS;
use tauri::State;

#[tauri::command]
pub fn media_info(
  url: String,
  id: String,
  group_id: String,
  pipeline: State<'_, FetchSender>,
) -> Result<String, String> {
  RUNNING_GROUPS
    .lock()
    .unwrap()
    .insert(group_id.clone(), true);

  pipeline
    .0
    .send(DispatchRequest::Pipeline(FetchRequest::Initial {
      group_id: group_id.clone(),
      url,
      id,
    }))
    .map_err(|e| e.to_string())?;

  Ok(group_id)
}
