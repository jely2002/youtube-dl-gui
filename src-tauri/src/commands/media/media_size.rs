use crate::models::download::{DownloadOverrides, FormatOptions};
use crate::scheduling::dispatcher::DispatchRequest;
use crate::scheduling::fetch_pipeline::{FetchRequest, FetchSender};
use crate::scheduling::group_state::ensure_group_running;
use tauri::State;

#[tauri::command]
pub fn media_size(
  url: String,
  id: String,
  group_id: String,
  format: FormatOptions,
  overrides: Option<DownloadOverrides>,
  pipeline: State<'_, FetchSender>,
) -> Result<String, String> {
  ensure_group_running(&group_id);

  pipeline
    .0
    .send(DispatchRequest::Pipeline(FetchRequest::Size {
      group_id: group_id.clone(),
      url,
      id,
      format,
      // The size must be looked up the way the item will be downloaded: same cookies, headers, proxy.
      overrides: Box::new(overrides),
    }))
    .map_err(|e| e.to_string())?;

  Ok(group_id)
}
