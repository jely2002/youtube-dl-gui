use crate::models::ytdlp::YtdlpFormat;
use crate::models::MediaTrack;

pub(super) fn has_audio_stream(fmt: &YtdlpFormat) -> bool {
  fmt.acodec.as_deref().is_some_and(|ac| ac != "none")
}

pub(super) fn has_video_stream(fmt: &YtdlpFormat) -> bool {
  if is_storyboard_format(fmt) {
    return false;
  }
  fmt.vcodec.as_deref().is_some_and(is_real_video_codec) || fmt.height.is_some()
}

pub(super) fn to_track(fmt: &YtdlpFormat) -> MediaTrack {
  let language = normalize_text(&fmt.language);
  let format_note = normalize_text(&fmt.format_note);
  let format = normalize_text(&fmt.format);
  let audio_channels = fmt
    .audio_channels
    .map(|c| c.round() as u64)
    .filter(|c| *c > 0);
  let language_preference = fmt.language_preference;

  let mut id_parts = Vec::new();
  if let Some(lang) = &language {
    id_parts.push(format!("lang:{lang}"));
  }
  if let Some(ch) = audio_channels {
    id_parts.push(format!("channels:{ch}"));
  }
  let id = if id_parts.is_empty() {
    "auto".to_string()
  } else {
    id_parts.join("|")
  };

  let mut label_parts = Vec::new();
  if let Some(lang) = &language {
    label_parts.push(lang.clone());
  }
  if let Some(ch) = audio_channels {
    label_parts.push(format!("{ch}ch"));
  }
  let label = if label_parts.is_empty() {
    "Auto".to_string()
  } else {
    label_parts.join(" - ")
  };

  MediaTrack {
    id,
    label,
    language,
    language_preference,
    format_note,
    format,
    audio_channels,
  }
}

pub(super) fn auto_track() -> MediaTrack {
  MediaTrack {
    id: "auto".to_string(),
    label: "Auto".to_string(),
    language: None,
    language_preference: None,
    format_note: None,
    format: None,
    audio_channels: None,
  }
}

pub(super) fn sort_tracks(tracks: &mut [MediaTrack]) {
  tracks.sort_by(|a, b| {
    let a_auto = a.id == "auto";
    let b_auto = b.id == "auto";
    a_auto
      .cmp(&b_auto)
      .then_with(|| {
        b.language_preference
          .unwrap_or(i64::MIN)
          .cmp(&a.language_preference.unwrap_or(i64::MIN))
      })
      .then_with(|| a.label.cmp(&b.label))
  });
}

pub(super) fn is_real_video_codec(vc: &str) -> bool {
  let lower = vc.trim().to_lowercase();
  lower != "none" && lower != "images"
}

fn normalize_text(v: &Option<String>) -> Option<String> {
  v.as_ref()
    .map(|s| s.trim())
    .filter(|s| !s.is_empty())
    .map(ToOwned::to_owned)
}

fn is_storyboard_format(fmt: &YtdlpFormat) -> bool {
  let note = fmt
    .format_note
    .as_deref()
    .unwrap_or_default()
    .to_lowercase();
  let format = fmt.format.as_deref().unwrap_or_default().to_lowercase();
  note.contains("storyboard") || format.contains("storyboard")
}

#[cfg(test)]
mod tests {
  use super::super::test_support::make_format;
  use super::{has_video_stream, to_track};
  use crate::models::ytdlp::YtdlpFormat;

  #[test]
  fn track_identity_ignores_quality_notes() {
    let fmt_1080 = make_format(
      Some("en-us"),
      Some(10),
      Some("1080p"),
      Some("1080p"),
      Some(2.0),
      Some("avc1"),
      Some("aac"),
    );
    let fmt_720 = make_format(
      Some("en-us"),
      Some(10),
      Some("720p"),
      Some("720p"),
      Some(2.0),
      Some("avc1"),
      Some("aac"),
    );

    let track_1080 = to_track(&fmt_1080);
    let track_720 = to_track(&fmt_720);

    assert_eq!(track_1080.id, "lang:en-us|channels:2");
    assert_eq!(track_1080.id, track_720.id);
    assert_eq!(track_1080.label, "en-us - 2ch");
  }

  #[test]
  fn storyboard_formats_do_not_count_as_video_streams() {
    let fmt = YtdlpFormat {
      format_id: Some("sb0".into()),
      format: Some("storyboard".into()),
      format_note: Some("storyboard".into()),
      height: Some(1080),
      fps: Some(1.0),
      abr: None,
      audio_channels: None,
      language: None,
      language_preference: None,
      ext: Some("mhtml".into()),
      vcodec: Some("none".into()),
      acodec: Some("none".into()),
    };

    assert!(!has_video_stream(&fmt));
  }
}
