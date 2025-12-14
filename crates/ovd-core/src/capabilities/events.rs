use serde::Serialize;
use serde_json::Value;
use std::fmt;

pub trait EventSink: Send + Sync + 'static {
  fn emit_value(&self, event: &'static str, payload: Value) -> Result<(), EventError>;
}

#[derive(Debug)]
pub struct EventError(pub String);

impl fmt::Display for EventError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    f.write_str(&self.0)
  }
}

impl std::error::Error for EventError {}

pub trait EventSinkExt {
  fn emit<T: Serialize>(&self, event: &'static str, payload: T) -> Result<(), EventError>;
}

impl<S: EventSink + ?Sized> EventSinkExt for S {
  fn emit<T: Serialize>(&self, event: &'static str, payload: T) -> Result<(), EventError> {
    let value = serde_json::to_value(payload)
      .map_err(|e| EventError(format!("serialize event payload failed: {e}")))?;
    self.emit_value(event, value)
  }
}
