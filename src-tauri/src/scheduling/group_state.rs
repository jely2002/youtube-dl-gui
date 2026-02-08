use std::collections::HashMap;
use std::sync::{LazyLock, Mutex as StdMutex};
use tokio::sync::watch;

static RUNNING_GROUPS: LazyLock<StdMutex<HashMap<String, watch::Sender<bool>>>> =
  LazyLock::new(|| StdMutex::new(HashMap::new()));

pub fn ensure_group_running(group_id: &str) {
  let mut map = RUNNING_GROUPS.lock().unwrap();
  if let Some(tx) = map.get(group_id) {
    let _ = tx.send(true);
  } else {
    let (tx, _rx) = watch::channel(true);
    map.insert(group_id.to_string(), tx);
  }
}

pub fn cancel_group(group_id: &str) {
  let mut map = RUNNING_GROUPS.lock().unwrap();
  if let Some(tx) = map.get(group_id) {
    let _ = tx.send(false);
  } else {
    let (tx, _rx) = watch::channel(false);
    map.insert(group_id.to_string(), tx);
  }
}

pub fn remove_group(group_id: &str) {
  RUNNING_GROUPS.lock().unwrap().remove(group_id);
}

pub fn subscribe_group(group_id: &str) -> watch::Receiver<bool> {
  let mut map = RUNNING_GROUPS.lock().unwrap();
  if let Some(tx) = map.get(group_id) {
    tx.subscribe()
  } else {
    let (tx, rx) = watch::channel(true);
    map.insert(group_id.to_string(), tx);
    rx
  }
}

pub fn is_group_running(group_id: &str) -> bool {
  RUNNING_GROUPS
    .lock()
    .unwrap()
    .get(group_id)
    .map(|tx| *tx.borrow())
    .unwrap_or(false)
}
