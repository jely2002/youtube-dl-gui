use crate::logging::LogStoreState;
use crate::models::download::FormatOptions;
use crate::models::{MediaDiagnosticPayload, MediaFatalPayload, ParsedMedia, TrackType};
use crate::parsers::ytdlp_error::{DiagnosticMatcher, YtdlpErrorParser};
use crate::parsers::ytdlp_info::parse_ytdlp_info;
use crate::runners::ytdlp_runner::YtdlpRunner;
use std::borrow::Cow;
use std::fmt;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug)]
pub enum YtdlpInfoFetchError {
  InvalidDiagnosticRules(String),
  RunnerFailed(String),
  NonZeroExit(i32),
  ParseFailed(String),
}

impl fmt::Display for YtdlpInfoFetchError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::InvalidDiagnosticRules(e) => write!(f, "Invalid diagnostic rules: {e}"),
      Self::RunnerFailed(e) => write!(f, "yt-dlp invocation failed: {e}"),
      Self::NonZeroExit(code) => write!(f, "yt-dlp exited with code {code}"),
      Self::ParseFailed(e) => write!(f, "Failed to parse yt-dlp output: {e}"),
    }
  }
}

impl std::error::Error for YtdlpInfoFetchError {}

pub async fn run_ytdlp_info_fetch(
  app: &AppHandle,
  id: String,
  group_id: String,
  url: &str,
  headers: Option<HashMap<String, String>>,
  format: Option<FormatOptions>,
) -> Result<Option<ParsedMedia>, YtdlpInfoFetchError> {
  static RULES_JSON: &str = include_str!("../diagnostic_rules.json");

  let runner = YtdlpRunner::new(app)
    .with_format_args(&format.unwrap_or(FormatOptions {
      track_type: TrackType::Both,
      abr: None,
      height: None,
      fps: None,
    }))
    .with_input_args()
    .with_auth_args()
    .with_network_args()
    .with_args(["-J", "--flat-playlist"])
    .with_url(url, &headers);

  let matcher = match DiagnosticMatcher::from_json(RULES_JSON) {
    Ok(m) => m,
    Err(e) => {
      let _ = app.emit(
        "media_fatal",
        MediaFatalPayload::internal(
          group_id.clone(),
          id.clone(),
          format!("Invalid diagnostic rules: {e}"),
          None,
        ),
      );
      return Err(YtdlpInfoFetchError::InvalidDiagnosticRules(e.to_string()));
    }
  };

  let error_parser = YtdlpErrorParser::new(&id, &group_id, matcher);

  let output = match runner.output().await {
    Ok(o) => o,
    Err(e) => {
      let _ = app.emit(
        "media_fatal",
        MediaFatalPayload::with_exit(
          group_id.clone(),
          id.clone(),
          1,
          format!("Failed to spawn yt-dlp: {e}"),
        ),
      );
      return Err(YtdlpInfoFetchError::RunnerFailed(e));
    }
  };

  let stdout_text = String::from_utf8_lossy(&output.stdout);
  let stderr_text = String::from_utf8_lossy(&output.stderr);

  let log_state = app.state::<LogStoreState>();

  {
    let mut lines: Vec<&str> = Vec::new();
    if !stderr_text.is_empty() {
      lines.extend(stderr_text.lines());
    }
    if !stdout_text.is_empty() {
      lines.extend(stdout_text.lines());
    }

    {
      let mut store = log_state.write();
      store.append_lines(app, &group_id, stderr_text.lines());
    }

    let events = error_parser.parse_lines(lines);
    for event in events {
      let _ = app.emit(
        "media_diagnostic",
        MediaDiagnosticPayload::from_diagnostic_event(event),
      );
    }
  }

  let status_code: i32 = output.status.code().unwrap_or(1);
  if status_code != 0 {
    // Truncate very large stderr payloads.
    let stderr_snippet: Cow<str> = if stderr_text.len() > 8_192 {
      Cow::Owned(format!(
        "{}… (truncated, {} bytes total)",
        &stderr_text[..8_192],
        stderr_text.len()
      ))
    } else {
      stderr_text.clone()
    };

    let _ = app.emit(
      "media_fatal",
      MediaFatalPayload::with_exit(
        group_id.clone(),
        id.clone(),
        status_code,
        stderr_snippet.into_owned(),
      ),
    );
    return Err(YtdlpInfoFetchError::NonZeroExit(status_code));
  }

  match parse_ytdlp_info(&stdout_text, id.clone()) {
    Ok(media) => Ok(Some(media)),
    Err(e) => {
      let _ = app.emit(
        "media_fatal",
        MediaFatalPayload::with_exit(
          group_id.clone(),
          id.clone(),
          1,
          format!("Failed to parse yt-dlp output: {e}"),
        ),
      );
      Err(YtdlpInfoFetchError::ParseFailed(e.to_string()))
    }
  }
}
