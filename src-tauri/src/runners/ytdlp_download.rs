use crate::logging::LogStoreState;
use crate::models::{
  MediaDiagnosticPayload, MediaFatalPayload, MediaProgressComplete, ProgressEvent,
};
use crate::parsers::ytdlp_error::{DiagnosticMatcher, YtdlpErrorParser};
use crate::parsers::ytdlp_progress::YtdlpProgressParser;
use crate::runners::ytdlp_runner::YtdlpRunner;
use crate::scheduling::download_pipeline::DownloadEntry;
use crate::{SharedConfig, RUNNING_GROUPS};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::CommandEvent;

pub async fn run_ytdlp_download(app: AppHandle, entry: DownloadEntry) {
  let output_path = resolve_output_path(&app);
  let output_str = output_path.to_string_lossy();
  let rendered_output_str = entry.template_context.render_template(output_str.as_ref());
  let runner = YtdlpRunner::new(&app)
    .with_progress_args()
    .with_network_args()
    .with_auth_args()
    .with_subtitle_args()
    .with_sponsorblock_args()
    .with_format_args(&entry.format)
    .with_input_args()
    .with_output_args(&entry.format)
    .with_args([
      "-o",
      rendered_output_str.as_ref(),
      "--output-na-placeholder",
      "\"\"",
      &entry.url,
    ]);

  static RULES_JSON: &str = include_str!("../diagnostic_rules.json");
  let matcher = DiagnosticMatcher::from_json(RULES_JSON).expect("invalid rules");
  let error_parser = YtdlpErrorParser::new(&entry.id, &entry.group_id, matcher);
  let mut progress_parser = YtdlpProgressParser::new(&entry.id, &entry.group_id);

  let (mut rx, child) = runner.spawn().expect("Failed to spawn yt-dlp");

  while let Some(event) = rx.recv().await {
    {
      let map = RUNNING_GROUPS.lock().unwrap();
      if !map.get(&entry.group_id).copied().unwrap_or(true) {
        tracing::info!("Cancelled processing for group_id {0}", entry.group_id);
        child.kill().ok();
        break;
      }
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
          app
            .emit(
              "media_complete",
              MediaProgressComplete {
                id: entry.id.clone(),
                group_id: entry.group_id.clone(),
              },
            )
            .ok();
        } else {
          app
            .emit(
              "media_fatal",
              MediaFatalPayload::with_exit(
                entry.group_id.clone(),
                entry.id.clone(),
                term.code.unwrap_or(1),
                format!("Download failed for group {0}", entry.group_id),
              ),
            )
            .ok();
        }
        break;
      }
      CommandEvent::Error(err) => {
        app
          .emit(
            "media_fatal",
            MediaFatalPayload::internal(
              entry.id.clone(),
              entry.group_id.clone(),
              format!("Download failed for group {0}: {1}", entry.group_id, err),
              Some(err),
            ),
          )
          .ok();
      }
      _ => {}
    }
  }
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

fn resolve_output_path(app: &AppHandle) -> PathBuf {
  let cfg_handle = app.state::<SharedConfig>();
  let cfg = cfg_handle.load();

  let base_dir = if let Some(dir) = &cfg.output.download_dir {
    PathBuf::from(dir)
  } else {
    app
      .path()
      .download_dir()
      .unwrap_or_else(|_| std::env::current_dir().expect("couldn’t get current dir"))
  };

  let filename = cfg.output.file_name_template.clone();

  base_dir.join(filename)
}
