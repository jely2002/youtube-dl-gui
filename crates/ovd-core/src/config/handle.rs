use crate::config::Config;
use arc_swap::ArcSwap;
use serde_json::{Map, Value};
use std::sync::Arc;

pub trait JsonStore: Send + Sync + 'static {
  fn get(&self, key: &str) -> Result<Option<Value>, String>;
  fn set(&self, key: &str, value: Value) -> Result<(), String>;
  fn save(&self) -> Result<(), String>;
}

pub const CONFIG_KEY: &str = "config";

pub struct ConfigHandle<S: JsonStore> {
  swap: Arc<ArcSwap<Config>>,
  store: Arc<S>,
}

impl<S: JsonStore> ConfigHandle<S> {
  pub fn init(store: Arc<S>) -> Result<Self, String> {
    let raw = store
      .get(CONFIG_KEY)?
      .unwrap_or_else(|| Value::Object(Map::new()));

    let initial = materialize_config(&raw)?;

    store.set(
      CONFIG_KEY,
      serde_json::to_value(&initial).map_err(|e| e.to_string())?,
    )?;
    store.save()?;

    Ok(Self {
      swap: Arc::new(ArcSwap::from_pointee(initial)),
      store,
    })
  }

  #[inline]
  pub fn load(&self) -> Arc<Config> {
    self.swap.load_full()
  }

  pub fn apply_patch(&self, patch: &Value) -> Result<Config, String> {
    let mut raw = self
      .store
      .get(CONFIG_KEY)?
      .unwrap_or_else(|| Value::Object(Map::new()));

    json_merge(&mut raw, patch);

    let new_cfg = materialize_config(&raw)?;

    self.store.set(CONFIG_KEY, raw)?;
    self.store.save()?;
    self.swap.store(Arc::new(new_cfg.clone()));

    Ok(new_cfg)
  }

  pub fn reset(&self) -> Result<Config, String> {
    let default_cfg = Config::default();
    let raw = serde_json::to_value(&default_cfg).map_err(|e| e.to_string())?;

    self.store.set(CONFIG_KEY, raw)?;
    self.store.save()?;
    self.swap.store(Arc::new(default_cfg.clone()));

    Ok(default_cfg)
  }
}

fn materialize_config(raw: &Value) -> Result<Config, String> {
  let mut merged = serde_json::to_value(Config::default()).map_err(|e| e.to_string())?;
  json_merge(&mut merged, raw);
  serde_json::from_value(merged).map_err(|e| e.to_string())
}

fn json_merge(base: &mut Value, patch: &Value) {
  match (base, patch) {
    (Value::Object(base_map), Value::Object(patch_map)) => {
      for (k, v) in patch_map {
        json_merge(base_map.entry(k).or_insert(Value::Null), v);
      }
    }
    (a, b) => *a = b.clone(),
  }
}
