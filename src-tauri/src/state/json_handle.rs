use crate::paths::PathsManager;
use crate::state::json_state::{json_merge, JsonBackedState};
use arc_swap::ArcSwap;
use serde_json::{Map, Value};
use std::{error::Error, sync::Arc};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_store::{Store, StoreExt};

pub struct JsonStoreHandle<T: JsonBackedState> {
  swap: Arc<ArcSwap<T>>,
  store: Arc<Store<Wry>>,
}

impl<T: JsonBackedState> JsonStoreHandle<T> {
  pub fn init(app: &AppHandle<Wry>) -> Result<Self, Box<dyn Error>> {
    let paths_manager = app.state::<PathsManager>();
    let data_root = paths_manager.app_dir();
    let store_path = data_root.join(T::STORE_FILE);
    let store = app.store(store_path)?;

    let raw = store
      .get(T::ROOT_KEY)
      .unwrap_or_else(|| Value::Object(Map::new()));

    let mut initial = T::materialize(&raw)?;
    T::before_initialized(app, &mut initial);

    let to_save = serde_json::to_value(&initial)?;
    store.set(T::ROOT_KEY, to_save);
    store.save()?;

    Ok(Self {
      swap: Arc::new(ArcSwap::from_pointee(initial)),
      store,
    })
  }

  #[inline]
  pub fn load(&self) -> Arc<T> {
    self.swap.load_full()
  }

  pub fn apply_patch(&self, patch: &Value, app: &AppHandle<Wry>) -> Result<T, Box<dyn Error>> {
    let mut raw = self
      .store
      .get(T::ROOT_KEY)
      .unwrap_or_else(|| Value::Object(Map::new()));

    json_merge(&mut raw, patch);

    let new_value = T::materialize(&raw)?;
    T::on_updated(app, &new_value);

    self.store.set(T::ROOT_KEY, raw.clone());
    self.store.save()?;
    self.swap.store(Arc::new(new_value.clone()));

    Ok(new_value)
  }

  pub fn reset(&self, app: &AppHandle<Wry>) -> Result<T, Box<dyn Error>> {
    let default_value = T::default_value();
    let raw = serde_json::to_value(&default_value)?;

    T::on_updated(app, &default_value);

    self.store.set(T::ROOT_KEY, raw);
    self.store.save()?;
    self.swap.store(Arc::new(default_value.clone()));

    Ok(default_value)
  }
}
