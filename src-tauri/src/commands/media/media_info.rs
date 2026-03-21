use crate::scheduling::dispatcher::DispatchRequest;
use crate::scheduling::fetch_pipeline::FetchRequest;
use crate::scheduling::group_state::ensure_group_running;
use crate::FetchSender;
use tauri::State;

#[tauri::command]
pub fn media_info(
  url: String,
  id: String,
  group_id: String,
  pipeline: State<'_, FetchSender>,
) -> Result<String, String> {
  ensure_group_running(&group_id);

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
