use ovd_core::capabilities::AuthSecretsStore;
use std::sync::{Arc, Mutex};

pub struct StrongholdTauriState {
  pub secrets: Arc<dyn AuthSecretsStore>,
  pub init_error: Mutex<Option<String>>,
}

impl StrongholdTauriState {
  pub fn new(secrets: Arc<dyn AuthSecretsStore>) -> Self {
    Self {
      secrets,
      init_error: Mutex::new(None),
    }
  }
}
