use crate::capabilities::{CoreCtx, EventSinkExt, ProcessEvent};
use crate::models::{
  MediaDiagnosticPayload, MediaFatalPayload, MediaProgressComplete, ProgressEvent, TrackType,
};
use crate::parsers::ytdlp_error::{DiagnosticMatcher, YtdlpErrorParser};
use crate::parsers::ytdlp_progress::YtdlpProgressParser;
use crate::runners::ytdlp_runner::YtdlpRunner;
use crate::scheduling::download_pipeline::DownloadEntry;
use crate::RUNNING_GROUPS;
use std::path::PathBuf;

pub async fn run_ytdlp_download(ctx: CoreCtx, entry: DownloadEntry) {
  let output_path = resolve_output_path(&ctx, entry.format.track_type.clone());
  let output_str = output_path.to_string_lossy();
  let rendered_output_str = entry.template_context.render_template(output_str.as_ref());
  let runner = YtdlpRunner::new(&ctx)
    .with_progress_args()
    .with_network_args()
    .with_auth_args()
    .with_subtitle_args()
    .with_sponsorblock_args()
    .with_format_args(&entry.format)
    .with_input_args()
    .with_output_args(&entry.format)
    .with_args(["-o", rendered_output_str.as_ref(), &entry.url]);

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

    match event {
      ProcessEvent::Stdout(line) => {
        let line_str = String::from_utf8_lossy(&line);
        store_log_line(&line_str, &entry, &ctx);
        parse_progress_line(&line_str, &mut progress_parser, &ctx);
      }
      ProcessEvent::Stderr(line) => {
        let line_str = String::from_utf8_lossy(&line);
        store_log_line(&line_str, &entry, &ctx);
        parse_error_line(&line_str, &error_parser, &ctx);
      }
      ProcessEvent::Terminated(term) => {
        if term.code == Some(0) {
          ctx
            .events
            .emit(
              "media_complete",
              MediaProgressComplete {
                id: entry.id.clone(),
                group_id: entry.group_id.clone(),
              },
            )
            .ok();
        } else {
          ctx
            .events
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
      ProcessEvent::Error(err) => {
        ctx
          .events
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
    }
  }
}

fn store_log_line(line: &str, entry: &DownloadEntry, ctx: &CoreCtx) {
  if line.is_empty() || line.starts_with("RAW") {
    return;
  }
  let mut store = ctx.logging.write();
  store.append_line(ctx, &entry.group_id, line);
}

fn parse_progress_line(line: &str, progress_parser: &mut YtdlpProgressParser, ctx: &CoreCtx) {
  let progress_events = progress_parser.parse_line(line);

  for progress_event in progress_events {
    match progress_event {
      ProgressEvent::Destination(destination) => {
        ctx.events.emit("media_destination", destination).ok();
      }
      ProgressEvent::Progress(progress) => {
        ctx.events.emit("media_progress", progress).ok();
      }
      ProgressEvent::StageChange(progress) => {
        ctx.events.emit("media_progress_stage", progress).ok();
      }
    }
  }
}

fn parse_error_line(line: &str, error_parser: &YtdlpErrorParser, ctx: &CoreCtx) {
  if let Some(event) = error_parser.parse_line(line) {
    ctx
      .events
      .emit(
        "media_diagnostic",
        MediaDiagnosticPayload::from_diagnostic_event(event),
      )
      .ok();
  }
}

fn resolve_output_path(ctx: &CoreCtx, track_type: TrackType) -> PathBuf {
  let cfg = ctx.config.load();

  let base_dir = if let Some(dir) = &cfg.output.download_dir {
    PathBuf::from(dir)
  } else {
    ctx.paths.download_dir.clone()
  };

  let filename = match track_type {
    TrackType::Both | TrackType::Video => cfg.output.file_name_template.clone(),
    TrackType::Audio => cfg.output.audio_file_name_template.clone(),
  };

  base_dir.join(filename)
}
