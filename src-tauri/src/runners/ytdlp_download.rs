use crate::logging::LogStoreState;
use crate::models::{
  MediaDiagnosticPayload, MediaFatalPayload, MediaProgressComplete, ProgressEvent,
};
use crate::parsers::ytdlp_error::{DiagnosticMatcher, YtdlpErrorParser};
use crate::parsers::ytdlp_progress::YtdlpProgressParser;
use crate::runners::ytdlp_runner::YtdlpRunner;
use crate::scheduling::download_pipeline::DownloadEntry;
use crate::RUNNING_GROUPS;
use std::fmt;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::CommandEvent;

#[derive(Debug)]
pub enum YtdlpDownloadError {
  InvalidDiagnosticRules(String),
  SpawnFailed(String),
  RunnerError(String),
  NonZeroExit(i32),
  EventStreamEnded,
}

impl fmt::Display for YtdlpDownloadError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::InvalidDiagnosticRules(e) => write!(f, "Invalid diagnostic rules: {e}"),
      Self::SpawnFailed(e) => write!(f, "Failed to spawn yt-dlp: {e}"),
      Self::RunnerError(e) => write!(f, "yt-dlp runner error: {e}"),
      Self::NonZeroExit(code) => write!(f, "yt-dlp exited with code {code}"),
      Self::EventStreamEnded => write!(f, "yt-dlp event stream ended unexpectedly"),
    }
  }
}

impl std::error::Error for YtdlpDownloadError {}

pub async fn run_ytdlp_download(
  app: AppHandle,
  entry: DownloadEntry,
) -> Result<(), YtdlpDownloadError> {
  let runner = YtdlpRunner::new(&app)
    .with_progress_args()
    .with_network_args()
    .with_auth_args()
    .with_subtitle_args()
    .with_sponsorblock_args()
    .with_format_args(&entry.format)
    .with_input_args()
    .with_output_args(&entry.format)
    .with_location_args(&entry.format.track_type, &entry.template_context)
    .with_args(["--output-na-placeholder", "None", &entry.url]);

  static RULES_JSON: &str = include_str!("../diagnostic_rules.json");
  let matcher = DiagnosticMatcher::from_json(RULES_JSON)
    .map_err(|e| YtdlpDownloadError::InvalidDiagnosticRules(e.to_string()))?;

  let error_parser = YtdlpErrorParser::new(&entry.id, &entry.group_id, matcher);
  let mut progress_parser = YtdlpProgressParser::new(&entry.id, &entry.group_id);

  let (mut rx, child) = runner.spawn().map_err(YtdlpDownloadError::SpawnFailed)?;

  while let Some(event) = rx.recv().await {
    let cancelled = {
      let map = RUNNING_GROUPS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
      !map.get(&entry.group_id).copied().unwrap_or(true)
    };

    if cancelled {
      tracing::info!("Cancelled processing for group_id {}", entry.group_id);
      let _ = child.kill();
      return Ok(());
    }

    let log_state = app.state::<LogStoreState>();

    match event {
      CommandEvent::Stdout(line) => {
        let line_str = String::from_utf8_lossy(&line);
        store_log_line(&line_str, &entry, log_state, &app);
        parse_progress_line(&line_str, &mut progress_parser, &app);
      }
      CommandEvent::Stderr(line) => {
        let line_str = String::from_utf8_lossy(&line);
        store_log_line(&line_str, &entry, log_state, &app);
        parse_error_line(&line_str, &error_parser, &app);
      }
      CommandEvent::Terminated(term) => {
        if term.code == Some(0) {
          let _ = app.emit(
            "media_complete",
            MediaProgressComplete {
              id: entry.id.clone(),
              group_id: entry.group_id.clone(),
            },
          );
          return Ok(());
        }

        let exit = term.code.unwrap_or(1);
        let _ = app.emit(
          "media_fatal",
          MediaFatalPayload::with_exit(
            entry.group_id.clone(),
            entry.id.clone(),
            exit,
            format!("Download failed for group {}", entry.group_id),
          ),
        );
        return Err(YtdlpDownloadError::NonZeroExit(exit));
      }
      CommandEvent::Error(err) => {
        let msg = format!("Download failed for group {}: {}", entry.group_id, err);
        let _ = app.emit(
          "media_fatal",
          MediaFatalPayload::internal(
            entry.id.clone(),
            entry.group_id.clone(),
            msg.clone(),
            Some(err.clone()),
          ),
        );

        return Err(YtdlpDownloadError::RunnerError(err));
      }
      _ => {}
    }
  }

  Err(YtdlpDownloadError::EventStreamEnded)
}

fn store_log_line(
  line: &str,
  entry: &DownloadEntry,
  log_state: State<LogStoreState>,
  app: &AppHandle,
) {
  if line.is_empty() || line.starts_with("RAW") {
    return;
  }
  let mut store = log_state.write();
  store.append_line(app, &entry.group_id, line);
}

fn parse_progress_line(line: &str, progress_parser: &mut YtdlpProgressParser, app: &AppHandle) {
  let progress_events = progress_parser.parse_line(line);

  for progress_event in progress_events {
    match progress_event {
      ProgressEvent::Destination(destination) => {
        app.emit("media_destination", destination).ok();
      }
      ProgressEvent::Progress(progress) => {
        app.emit("media_progress", progress).ok();
      }
      ProgressEvent::StageChange(progress) => {
        app.emit("media_progress_stage", progress).ok();
      }
    }
  }
}

fn parse_error_line(line: &str, error_parser: &YtdlpErrorParser, app: &AppHandle) {
  if let Some(event) = error_parser.parse_line(line) {
    app
      .emit(
        "media_diagnostic",
        MediaDiagnosticPayload::from_diagnostic_event(event),
      )
      .ok();
  }
}
