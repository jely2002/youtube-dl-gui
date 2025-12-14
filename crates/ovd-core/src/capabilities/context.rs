use crate::capabilities::{AuthSecretsStore, EventSink, PathsManager, ProcessRunner, Spawner};
use crate::config::Config;
use crate::logging::LogStoreState;
use std::sync::Arc;

pub type DynEventSink = Arc<dyn EventSink>;

pub trait ConfigProvider: Send + Sync + 'static {
  fn load(&self) -> Arc<Config>;
}

pub type DynConfigProvider = Arc<dyn ConfigProvider>;
pub type DynProcessRunner = Arc<dyn ProcessRunner>;
pub type DynSecretsStore = Arc<dyn AuthSecretsStore>;

#[derive(Clone)]
pub struct CoreCtx {
  pub events: DynEventSink,
  pub config: DynConfigProvider,
  pub process: DynProcessRunner,
  pub secrets: DynSecretsStore,
  pub paths: PathsManager,
  pub logging: Arc<LogStoreState>,
  pub spawner: Arc<dyn Spawner>,
}

impl CoreCtx {
  pub fn new(
    events: DynEventSink,
    config: DynConfigProvider,
    process: DynProcessRunner,
    spawner: Arc<dyn Spawner>,
    secrets: DynSecretsStore,
    paths: PathsManager,
    logging: LogStoreState,
  ) -> Self {
    Self {
      events,
      config,
      process,
      spawner,
      secrets,
      paths,
      logging: Arc::new(logging),
    }
  }
}
