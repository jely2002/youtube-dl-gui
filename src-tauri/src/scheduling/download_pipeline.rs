use crate::models::download::FormatOptions;
use crate::models::DownloadItem;
use crate::runners::ytdlp_download::run_ytdlp_download;
use crate::scheduling::dispatcher::{DispatchEntry, DispatchRequest, GenericDispatcher};
use crate::SharedConfig;
use std::sync::LazyLock;
use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
};
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct DownloadSender(pub UnboundedSender<DispatchRequest<DownloadRequest>>);

#[derive(Clone)]
pub enum DownloadRequest {
  Batch {
    group_id: String,
    items: Vec<DownloadItem>,
  },
}

#[derive(Clone)]
pub struct DownloadEntry {
  pub group_id: String,
  pub id: String,
  pub url: String,
  pub format: FormatOptions,
}

impl From<(DownloadItem, String)> for DownloadEntry {
  fn from(item: (DownloadItem, String)) -> Self {
    Self {
      group_id: item.1,
      id: item.0.id,
      url: item.0.url,
      format: item.0.format,
    }
  }
}

impl DispatchEntry for DownloadEntry {
  fn group_id(&self) -> &String {
    &self.group_id
  }
}

static DOWNLOAD_COUNTERS: LazyLock<Mutex<HashMap<String, usize>>> =
  LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn setup_download_dispatcher(app: &AppHandle) -> GenericDispatcher<DownloadRequest> {
  let cfg = app.state::<SharedConfig>().load();
  let sem = Arc::new(Semaphore::new(cfg.performance.max_concurrency));

  GenericDispatcher::start(
    app.clone(),
    sem,
    |req: DownloadRequest| match req {
      DownloadRequest::Batch { group_id, items } => {
        let total = items.len();
        DOWNLOAD_COUNTERS
          .lock()
          .unwrap()
          .insert(group_id.clone(), total);
        items
          .into_iter()
          .map(|item| DownloadEntry::from((item, group_id.clone())))
          .collect()
      }
    },
    |tx, app: AppHandle, entry: DownloadEntry| async move {
      tracing::info!("starting download id={} url={}", entry.id, entry.url);
      run_ytdlp_download(app.clone(), entry.clone()).await;
      let mut counters = DOWNLOAD_COUNTERS.lock().unwrap();
      if let Some(cnt) = counters.get_mut(&entry.group_id) {
        *cnt -= 1;
        if *cnt == 0 {
          counters.remove(&entry.group_id);
          let _ = tx.send(DispatchRequest::Cleanup {
            group_id: entry.group_id.clone(),
          });
        }
      }
    },
  )
}
