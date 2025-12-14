use crate::capabilities::{CoreCtx, EventSinkExt};
use crate::models::download::FormatOptions;
use crate::models::{MediaDiagnosticPayload, MediaFatalPayload, ParsedMedia, TrackType};
use crate::parsers::ytdlp_error::{DiagnosticMatcher, YtdlpErrorParser};
use crate::parsers::ytdlp_info::parse_ytdlp_info;
use crate::runners::ytdlp_runner::YtdlpRunner;
use std::borrow::Cow;

pub async fn run_ytdlp_info_fetch(
  ctx: &CoreCtx,
  id: String,
  group_id: String,
  url: &str,
  format: Option<FormatOptions>,
) -> Option<ParsedMedia> {
  static RULES_JSON: &str = include_str!("../diagnostic_rules.json");

  let runner = YtdlpRunner::new(ctx)
    .with_format_args(&format.unwrap_or(FormatOptions {
      track_type: TrackType::Both,
      asr: None,
      height: None,
      fps: None,
    }))
    .with_input_args()
    .with_auth_args()
    .with_network_args()
    .with_args(["-J", "--flat-playlist", url]);

  let matcher = match DiagnosticMatcher::from_json(RULES_JSON) {
    Ok(m) => m,
    Err(e) => {
      let _ = ctx.events.emit(
        "media_fatal",
        MediaFatalPayload::internal(
          group_id.clone(),
          id.clone(),
          format!("Invalid diagnostic rules: {e}"),
          None,
        ),
      );
      return None;
    }
  };

  let error_parser = YtdlpErrorParser::new(&id, &group_id, matcher);

  let output = match runner.shell().await {
    Ok(o) => o,
    Err(e) => {
      let _ = ctx.events.emit(
        "media_fatal",
        MediaFatalPayload::with_exit(
          group_id.clone(),
          id.clone(),
          1,
          format!("Failed to spawn yt-dlp: {e}"),
        ),
      );
      return None;
    }
  };

  let stdout_text = String::from_utf8_lossy(&output.stdout);
  let stderr_text = String::from_utf8_lossy(&output.stderr);

  {
    let mut lines: Vec<&str> = Vec::new();
    if !stderr_text.is_empty() {
      lines.extend(stderr_text.lines());
    }
    if !stdout_text.is_empty() {
      lines.extend(stdout_text.lines());
    }

    {
      let mut store = ctx.logging.write();
      store.append_lines(ctx, &group_id, stderr_text.lines());
    }

    let events = error_parser.parse_lines(lines);
    for event in events {
      let _ = ctx.events.emit(
        "media_diagnostic",
        MediaDiagnosticPayload::from_diagnostic_event(event),
      );
    }
  }

  let status_code: i32 = output.status_code;
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

    let _ = ctx.events.emit(
      "media_fatal",
      MediaFatalPayload::with_exit(
        group_id.clone(),
        id.clone(),
        status_code,
        stderr_snippet.into_owned(),
      ),
    );
    return None;
  }

  match parse_ytdlp_info(&stdout_text, id.clone()) {
    Ok(media) => Some(media),
    Err(e) => {
      let _ = ctx.events.emit(
        "media_fatal",
        MediaFatalPayload::with_exit(
          group_id,
          id,
          1,
          format!("Failed to parse yt-dlp output: {e}"),
        ),
      );
      None
    }
  }
}
