use ovd_core::capabilities::{EventError, EventSink};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

#[derive(Clone)]
pub struct TauriEventSink {
  app: AppHandle,
}

impl TauriEventSink {
  pub fn new(app: AppHandle) -> Self {
    Self { app }
  }
}

impl EventSink for TauriEventSink {
  fn emit_value(&self, event: &'static str, payload: Value) -> Result<(), EventError> {
    self
      .app
      .emit(event, payload)
      .map_err(|e| EventError(e.to_string()))?;
    Ok(())
  }
}
