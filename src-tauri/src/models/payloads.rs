use crate::models::download::FormatOptions;
use crate::models::error::{DiagnosticEvent, DiagnosticLevel};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAddPayload<Item> {
  pub group_id: String,
  pub total: usize,
  pub item: Item,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAddWithFormatPayload<Item> {
  pub group_id: String,
  pub total: usize,
  pub item: Item,
  pub format: FormatOptions,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDiagnosticPayload {
  pub group_id: String,
  pub id: String,
  pub level: DiagnosticLevel,
  pub code: String,
  pub component: Option<String>,
  pub message: String,
  pub raw: String,
  pub timestamp: u128,
}

impl MediaDiagnosticPayload {
  pub fn from_diagnostic_event(event: DiagnosticEvent) -> Self {
    Self {
      group_id: event.group_id,
      id: event.id,
      level: event.level,
      code: event.code,
      component: event.component,
      message: event.message,
      raw: event.raw,
      timestamp: event.timestamp,
    }
  }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFatalPayload {
  pub group_id: String,
  pub id: String,
  pub exit_code: Option<i32>,
  #[serde(default)]
  pub internal: bool,
  pub message: String,
  pub details: Option<String>,
  pub timestamp: u128,
}

impl MediaFatalPayload {
  pub fn internal(group_id: String, id: String, message: String, details: Option<String>) -> Self {
    Self {
      id,
      group_id,
      exit_code: None,
      internal: true,
      message,
      details,
      timestamp: std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0),
    }
  }

  pub fn with_exit(group_id: String, id: String, exit_code: i32, message: String) -> Self {
    Self {
      id,
      group_id,
      exit_code: Some(exit_code),
      internal: false,
      message,
      details: None,
      timestamp: std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0),
    }
  }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigatePayload {
  pub route: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendLogPayload {
  pub group_id: String,
  pub line: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutPayload {
  pub action: &'static str,
}
