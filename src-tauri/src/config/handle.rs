use crate::config::Config;
use crate::paths::PathsManager;
use arc_swap::ArcSwap;
use serde_json::{Map, Value};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_store::{Store, StoreExt};

pub const STORE_FILE: &str = "config.store.json";
pub const CONFIG_KEY: &str = "config";

pub struct ConfigHandle {
  swap: Arc<ArcSwap<Config>>,
  store: Arc<Store<Wry>>,
}

impl ConfigHandle {
  pub fn init(app: &AppHandle<Wry>) -> Result<Self, Box<dyn std::error::Error>> {
    let paths_manager = app.state::<PathsManager>();
    let data_root = paths_manager.app_dir();
    let store_path = data_root.join(STORE_FILE);
    let store = app.store(store_path)?;

    let raw = store
      .get(CONFIG_KEY)
      .unwrap_or_else(|| Value::Object(Map::new()));

    let initial = materialize_config(&raw)?;

    let to_save = serde_json::to_value(&initial)?;
    store.set(CONFIG_KEY, to_save);
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

  pub fn apply_patch(&self, patch: &Value) -> Result<Config, Box<dyn std::error::Error>> {
    let mut raw = self
      .store
      .get(CONFIG_KEY)
      .unwrap_or_else(|| Value::Object(Map::new()));

    json_merge(&mut raw, patch);

    let new_cfg = materialize_config(&raw)?;

    self.store.set(CONFIG_KEY, raw);
    self.store.save()?;
    self.swap.store(Arc::new(new_cfg.clone()));

    Ok(new_cfg)
  }

  pub fn reset(&self) -> Result<Config, Box<dyn std::error::Error>> {
    let default_cfg = Config::default();
    let raw = serde_json::to_value(&default_cfg)?;

    self.store.set(CONFIG_KEY, raw);
    self.store.save()?;
    self.swap.store(Arc::new(default_cfg.clone()));

    Ok(default_cfg)
  }
}

fn materialize_config(raw: &Value) -> Result<Config, Box<dyn std::error::Error>> {
  let mut merged = serde_json::to_value(Config::default())?;

  json_merge(&mut merged, raw);

  let cfg = serde_json::from_value(merged)?;
  Ok(cfg)
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
