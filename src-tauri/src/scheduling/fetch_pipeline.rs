use crate::models::download::FormatOptions;
use crate::models::payloads::MediaAddWithFormatPayload;
use crate::models::{MediaAddPayload, MediaFatalPayload};
use crate::runners::ytdlp_info::{run_ytdlp_info_fetch, YtdlpInfoFetchError};
use crate::{
  models::{ParsedMedia, ParsedPlaylist},
  scheduling::concurrency::DynamicSemaphore,
  scheduling::dispatcher::{DispatchEntry, DispatchRequest, GenericDispatcher},
};
use std::sync::LazyLock;
use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

#[derive(Clone)]
pub struct FetchSender(pub UnboundedSender<DispatchRequest<FetchRequest>>);

#[derive(Clone)]
pub enum FetchRequest {
  Initial {
    group_id: String,
    id: String,
    url: String,
    headers: Option<HashMap<String, String>>,
  },
  Playlist {
    group_id: String,
    playlist: ParsedPlaylist,
    headers: Option<HashMap<String, String>>,
  },
  Size {
    group_id: String,
    id: String,
    url: String,
    format: FormatOptions,
    headers: Option<HashMap<String, String>>,
  },
  SizePlaylist {
    group_id: String,
    playlist: ParsedPlaylist,
    format: FormatOptions,
    headers: Option<HashMap<String, String>>,
  },
}

#[derive(Clone)]
pub struct FetchEntry {
  pub group_id: String,
  pub id: String,
  pub url: String,
  pub total: usize,
  pub format: Option<FormatOptions>,
  pub headers: Option<HashMap<String, String>>,
}

impl DispatchEntry for FetchEntry {
  fn group_id(&self) -> &String {
    &self.group_id
  }
  fn group_key(&self) -> Option<&String> {
    None
  }
  fn set_numbering(&mut self, _autonumber: u64, _group_autonumber: Option<u64>) {}
}

static GROUP_COUNTERS: LazyLock<Mutex<HashMap<String, usize>>> =
  LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn setup_fetch_dispatcher(
  app: &AppHandle,
  sem: Arc<DynamicSemaphore>,
) -> GenericDispatcher<FetchRequest> {
  GenericDispatcher::start(
    app.clone(),
    sem,
    expand_fetch_request,
    |tx: UnboundedSender<DispatchRequest<FetchRequest>>, app: AppHandle, entry: FetchEntry| async move {
      handle_fetch_entry(tx, app, entry).await;
    },
  )
}

fn expand_fetch_request(req: FetchRequest) -> Vec<FetchEntry> {
  match req {
    FetchRequest::Initial { group_id, id, url, headers } => {
      vec![FetchEntry {
        group_id,
        id,
        url,
        total: 1,
        format: None,
        headers,
      }]
    }
    FetchRequest::Playlist { group_id, playlist, headers } => {
      let total = playlist.entries.len();
      playlist
        .entries
        .into_iter()
        .map(|e| FetchEntry {
          group_id: group_id.clone(),
          id: Uuid::new_v4().to_string(),
          url: e.video_url,
          total,
          format: None,
          headers: headers.clone(),
        })
        .collect()
    }
    FetchRequest::Size {
      group_id,
      id,
      url,
      format,
      headers,
    } => {
      vec![FetchEntry {
        group_id,
        id,
        url,
        total: 1,
        format: Some(format),
        headers,
      }]
    }
    FetchRequest::SizePlaylist {
      group_id,
      playlist,
      format,
      headers,
    } => {
      let total = playlist.entries.len();
      playlist
        .entries
        .into_iter()
        .map(|e| FetchEntry {
          group_id: group_id.clone(),
          id: Uuid::new_v4().to_string(),
          url: e.video_url,
          total,
          format: Some(format.clone()),
          headers: headers.clone(),
        })
        .collect()
    }
  }
}

async fn handle_fetch_entry(
  tx: UnboundedSender<DispatchRequest<FetchRequest>>,
  app: AppHandle,
  entry: FetchEntry,
) {
  let FetchEntry {
    group_id,
    id,
    url,
    total,
    format,
    headers,
  } = entry.clone();

  let result = run_ytdlp_info_fetch(&app, id.clone(), group_id.clone(), &url, headers.clone(), format.clone()).await;

  let result = match result {
    Ok(v) => v,
    Err(e) => {
      tracing::warn!(
        fetch_id = %id,
        group_id = %group_id,
        url = %url,
        error = %e,
        "run_ytdlp_info_fetch failed"
      );
      if should_report_to_sentry(&e) {
        sentry::capture_error(&e);
      }

      None
    }
  };

  match result {
    Some(ParsedMedia::Single(single)) => {
      if let Some(format) = format {
        let payload = MediaAddWithFormatPayload {
          group_id: group_id.clone(),
          total,
          item: single,
          format,
        };
        let _ = app.emit("media_size", payload);
      } else {
        let payload = MediaAddPayload {
          group_id: group_id.clone(),
          total,
          item: single,
        };
        let _ = app.emit("media_add", payload);
      }

      let mut counters = GROUP_COUNTERS.lock().unwrap();
      if let Some(cnt) = counters.get_mut(&group_id) {
        *cnt -= 1;
        if *cnt == 0 {
          counters.remove(&group_id);
          let _ = tx.send(DispatchRequest::Cleanup {
            group_id: group_id.clone(),
          });
        }
      }
    }
    Some(ParsedMedia::Playlist(pl)) => {
      GROUP_COUNTERS
        .lock()
        .unwrap()
        .insert(group_id.clone(), pl.entries.len());

      if let Some(format) = format {
        let _ = tx.send(DispatchRequest::Pipeline(FetchRequest::SizePlaylist {
          group_id: group_id.clone(),
          playlist: pl,
          format,
          headers: headers.clone(),
        }));
      } else {
        let _ = tx.send(DispatchRequest::Pipeline(FetchRequest::Playlist {
          group_id: group_id.clone(),
          playlist: pl.clone(),
          headers: headers.clone(),
        }));
        let payload = MediaAddPayload {
          group_id,
          total: pl.entries.len(),
          item: pl,
        };
        let _ = app.emit("media_add", payload);
      }
    }
    Some(ParsedMedia::Livestream(_)) => {
      let payload =
        MediaFatalPayload::internal(group_id.clone(), id, "Livestreams unsupported".into(), None);
      let _ = app.emit("media_fatal", payload);
      let mut counters = GROUP_COUNTERS.lock().unwrap();
      if let Some(cnt) = counters.get_mut(&group_id) {
        *cnt -= 1;
        if *cnt == 0 {
          counters.remove(&group_id);
          let _ = tx.send(DispatchRequest::Cleanup {
            group_id: group_id.clone(),
          });
        }
      }
    }
    None => {
      // Do nothing if no parsed result is returned. The events have already been sent.
    }
  }
}

fn should_report_to_sentry(err: &YtdlpInfoFetchError) -> bool {
  matches!(
    err,
    YtdlpInfoFetchError::InvalidDiagnosticRules(_)
      | YtdlpInfoFetchError::RunnerFailed(_)
      | YtdlpInfoFetchError::ParseFailed(_)
  )
}
