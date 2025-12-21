use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use std::error::Error;
use tauri::{AppHandle, Wry};

pub trait JsonBackedState:
  Sized + Clone + Send + Sync + 'static + Serialize + DeserializeOwned
{
  const STORE_FILE: &'static str;

  const ROOT_KEY: &'static str;

  fn default_value() -> Self;

  fn materialize(raw: &Value) -> Result<Self, Box<dyn Error>> {
    let mut merged = serde_json::to_value(Self::default_value())?;
    json_merge(&mut merged, raw);
    Ok(serde_json::from_value(merged)?)
  }

  fn on_updated(_app: &AppHandle<Wry>, _new_value: &Self) -> Result<(), Box<dyn Error>> {
    Ok(())
  }
}

pub fn json_merge(base: &mut Value, patch: &Value) {
  match (base, patch) {
    (Value::Object(base_map), Value::Object(patch_map)) => {
      for (k, v) in patch_map {
        json_merge(base_map.entry(k).or_insert(Value::Null), v);
      }
    }
    (a, b) => *a = b.clone(),
  }
}
