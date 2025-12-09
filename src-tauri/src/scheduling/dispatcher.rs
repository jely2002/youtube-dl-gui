use crate::scheduling::numbering::NumberingManager;
use crate::RUNNING_GROUPS;
use futures::Future;
use std::{collections::VecDeque, sync::Arc};
use tauri::AppHandle;
use tokio::sync::{mpsc, Semaphore};

pub trait DispatchEntry: Clone + Send + Sync + 'static {
  fn group_id(&self) -> &String;
  fn group_key(&self) -> Option<&String>;
  fn set_numbering(&mut self, autonumber: u64, group_autonumber: Option<u64>);
}

#[derive(Clone)]
pub enum DispatchRequest<Req> {
  Pipeline(Req),
  Cleanup { group_id: String },
}

pub struct GenericDispatcher<Req> {
  sender: mpsc::UnboundedSender<DispatchRequest<Req>>,
}

impl<Req> GenericDispatcher<Req>
where
  Req: Send + Sync + Clone + 'static,
{
  pub fn start<Entry, MakeEntries, RunJob, Fut>(
    app_handle: AppHandle,
    semaphore: Arc<Semaphore>,
    make_entries: MakeEntries,
    run_job: RunJob,
  ) -> Self
  where
    Entry: DispatchEntry,
    MakeEntries: Fn(Req) -> Vec<Entry> + Send + Sync + 'static,
    RunJob: Fn(mpsc::UnboundedSender<DispatchRequest<Req>>, AppHandle, Entry) -> Fut
      + Send
      + Sync
      + 'static,
    Fut: Future<Output = ()> + Send + 'static,
  {
    let (tx, mut rx) = mpsc::unbounded_channel::<DispatchRequest<Req>>();
    let tx_loop = tx.clone();
    let sem = semaphore;
    let app_main = app_handle;
    let make_entries = Arc::new(make_entries);
    let run_job = Arc::new(run_job);

    tauri::async_runtime::spawn(async move {
      let mut numbering = NumberingManager::new();
      let mut queues: VecDeque<(String, VecDeque<Entry>)> = VecDeque::new();

      loop {
        while let Ok(req) = rx.try_recv() {
          match req {
            DispatchRequest::Cleanup { group_id } => {
              queues.retain(|(gid, _)| gid != &group_id);
              RUNNING_GROUPS.lock().unwrap().remove(&group_id);
            }
            DispatchRequest::Pipeline(inner) => {
              let mut entries = make_entries(inner.clone());
              if !entries.is_empty() {
                let gid = entries[0].group_id().clone();
                if RUNNING_GROUPS
                  .lock()
                  .unwrap()
                  .get(&gid)
                  .copied()
                  .unwrap_or(false)
                {
                  for entry in entries.iter_mut() {
                    let group_key = entry.group_key();
                    let (autonumber, group_autonumber) = numbering.assign_for(group_key);
                    entry.set_numbering(autonumber, group_autonumber);
                  }

                  let q: VecDeque<Entry> = entries.into_iter().collect();
                  queues.push_back((gid, q));
                }
              }
            }
          }
        }

        queues.retain(|(gid, _)| {
          RUNNING_GROUPS
            .lock()
            .unwrap()
            .get(gid)
            .copied()
            .unwrap_or(false)
        });

        // If no work, block until the next request.
        if queues.is_empty() {
          if let Some(req) = rx.recv().await {
            let _ = tx_loop.send(req);
            continue;
          }
          break;
        }

        let mut free = sem.available_permits();
        while free > 0 && !queues.is_empty() {
          // Grab one permit
          let permit = sem.clone().acquire_owned().await.expect("Semaphore closed");

          // Pop the next group and its next entry
          let (group_id, mut q) = queues.pop_front().unwrap();

          // Skip cancelled groups.
          let still_running = RUNNING_GROUPS
            .lock()
            .unwrap()
            .get(&group_id)
            .copied()
            .unwrap_or(false);
          if !still_running {
            drop(permit);
            continue;
          }

          // Grab the entry that is going to be run.
          let entry = q.pop_front().unwrap();

          // Dispatch the entry with the permit.
          {
            let tx_job = tx_loop.clone();
            let app2 = app_main.clone();
            let run_job = run_job.clone();
            tauri::async_runtime::spawn(async move {
              run_job(tx_job, app2, entry.clone()).await;
              drop(permit);
            });
          }

          // Requeue if more groups are left.
          if !q.is_empty() {
            queues.push_back((group_id, q));
          }

          free -= 1;
        }
      }
    });

    Self { sender: tx }
  }

  pub fn sender(&self) -> mpsc::UnboundedSender<DispatchRequest<Req>> {
    self.sender.clone()
  }
}
