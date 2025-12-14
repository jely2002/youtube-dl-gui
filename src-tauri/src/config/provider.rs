use ovd_core::capabilities::ConfigProvider;
use ovd_core::config::{Config, ConfigHandle, JsonStore};
use std::sync::Arc;

#[derive(Clone)]
pub struct HandleConfigProvider<S: JsonStore> {
  handle: Arc<ConfigHandle<S>>,
}

impl<S: JsonStore> HandleConfigProvider<S> {
  pub fn new(handle: Arc<ConfigHandle<S>>) -> Self {
    Self { handle }
  }
}

impl<S: JsonStore> ConfigProvider for HandleConfigProvider<S> {
  fn load(&self) -> Arc<Config> {
    self.handle.load()
  }
}
