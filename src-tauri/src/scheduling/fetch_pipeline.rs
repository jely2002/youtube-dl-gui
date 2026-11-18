use crate::models::download::{DownloadOverrides, FormatOptions};
use crate::models::payloads::MediaAddWithFormatPayload;
use crate::models::{MediaAddPayload, MediaFatalPayload, PlaylistEntry};
use crate::runners::ytdlp_info::{run_ytdlp_info_fetch, YtdlpInfoFetchError};
use crate::{
  models::{ParsedMedia, ParsedPlaylist},
  scheduling::concurrency::DynamicSemaphore,
  scheduling::dispatcher::{DispatchEntry, DispatchRequest, GenericDispatcher},
};
use std::collections::HashMap;
use std::sync::LazyLock;
use std::sync::{Arc, Mutex};
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
    overrides: Box<Option<DownloadOverrides>>,
  },
  Playlist {
    group_id: String,
    entries: Vec<PlaylistEntry>,
    overrides: Box<Option<DownloadOverrides>>,
  },
  Size {
    group_id: String,
    id: String,
    url: String,
    format: FormatOptions,
    overrides: Box<Option<DownloadOverrides>>,
  },
  SizePlaylist {
    group_id: String,
    playlist: ParsedPlaylist,
    format: FormatOptions,
    overrides: Box<Option<DownloadOverrides>>,
  },
}

#[derive(Clone)]
pub struct FetchEntry {
  pub group_id: String,
  pub id: String,
  pub url: String,
  pub total: usize,
  pub format: Option<FormatOptions>,
  pub overrides: Option<DownloadOverrides>,
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
    FetchRequest::Initial {
      group_id,
      id,
      url,
      overrides,
    } => {
      vec![FetchEntry {
        group_id,
        id,
        url,
        total: 1,
        format: None,
        overrides: *overrides,
      }]
    }
    FetchRequest::Playlist {
      group_id,
      entries,
      overrides,
    } => {
      let total = entries.len();
      GROUP_COUNTERS
        .lock()
        .unwrap()
        .insert(group_id.clone(), total);
      entries
        .into_iter()
        .map(|e| FetchEntry {
          group_id: group_id.clone(),
          id: Uuid::new_v4().to_string(),
          url: e.video_url,
          total,
          format: None,
          overrides: *overrides.clone(),
        })
        .collect()
    }
    FetchRequest::Size {
      group_id,
      id,
      url,
      format,
      overrides,
    } => {
      vec![FetchEntry {
        group_id,
        id,
        url,
        total: 1,
        format: Some(format),
        overrides: *overrides,
      }]
    }
    FetchRequest::SizePlaylist {
      group_id,
      playlist,
      format,
      overrides,
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
          overrides: *overrides.clone(),
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
    overrides,
  } = entry.clone();

  let result = run_ytdlp_info_fetch(
    &app,
    id.clone(),
    group_id.clone(),
    &url,
    format.clone(),
    overrides.clone(),
  )
  .await;

  let result = match result {
    Ok(v) => v,
    Err(e) => {
      tracing::warn!(
        fetch_id = %id,
        group_id = %group_id,
        url = %DownloadOverrides::loggable_url(overrides.as_ref(), &url),
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
      if let Some(format) = format {
        let _ = tx.send(DispatchRequest::Pipeline(FetchRequest::SizePlaylist {
          group_id: group_id.clone(),
          playlist: pl,
          format,
          overrides: Box::new(overrides),
        }));
      } else {
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

#[cfg(test)]
mod tests {
  use super::{expand_fetch_request, FetchRequest};
  use crate::models::download::{AuthOverrides, DownloadOverrides, FormatOptions};
  use crate::models::TrackType;

  #[test]
  fn size_lookup_keeps_the_items_overrides() {
    let overrides = DownloadOverrides {
      auth: Some(AuthOverrides {
        cookie_file: Some("/tmp/cookies.txt".into()),
        ..AuthOverrides::default()
      }),
      ..DownloadOverrides::default()
    };
    let entries = expand_fetch_request(FetchRequest::Size {
      group_id: "group".into(),
      id: "id".into(),
      url: "https://example.com/master.m3u8".into(),
      format: FormatOptions {
        track_type: TrackType::Both,
        abr: None,
        height: None,
        fps: None,
        audio_encoding: None,
        video_encoding: None,
        audio_track: None,
        video_track: None,
      },
      overrides: Box::new(Some(overrides)),
    });

    let auth = entries[0].overrides.as_ref().and_then(|o| o.auth.as_ref());
    assert_eq!(
      auth.and_then(|a| a.cookie_file.as_deref()),
      Some("/tmp/cookies.txt")
    );
  }
}
