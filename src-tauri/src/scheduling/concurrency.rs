use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::{Mutex, OwnedSemaphorePermit, Semaphore};

pub struct DynamicSemaphore {
  semaphore: Arc<Semaphore>,
  max: AtomicUsize,
  held: Mutex<Vec<OwnedSemaphorePermit>>,
}

impl DynamicSemaphore {
  pub fn new(max: usize) -> Self {
    let max = max.max(1);
    Self {
      semaphore: Arc::new(Semaphore::new(max)),
      max: AtomicUsize::new(max),
      held: Mutex::new(Vec::new()),
    }
  }

  pub fn available_permits(&self) -> usize {
    self.semaphore.available_permits()
  }

  pub async fn acquire_owned(self: &Arc<Self>) -> OwnedSemaphorePermit {
    self
      .semaphore
      .clone()
      .acquire_owned()
      .await
      .expect("Semaphore closed")
  }

  pub async fn resize(&self, new_max: usize) {
    let new_max = new_max.max(1);
    let old_max = self.max.swap(new_max, Ordering::SeqCst);

    if new_max > old_max {
      let mut remaining = new_max - old_max;
      let mut held = self.held.lock().await;
      while remaining > 0 && !held.is_empty() {
        held.pop();
        remaining -= 1;
      }
      drop(held);
      if remaining > 0 {
        self.semaphore.add_permits(remaining);
      }
      return;
    }

    if new_max < old_max {
      let mut to_hold = old_max - new_max;
      while to_hold > 0 {
        let permit = self
          .semaphore
          .clone()
          .acquire_owned()
          .await
          .expect("Semaphore closed");
        let mut held = self.held.lock().await;
        held.push(permit);
        to_hold -= 1;
      }
    }
  }
}
