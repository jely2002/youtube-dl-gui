use crate::models::ytdlp::YtdlpFormat;
use crate::models::YtdlpInfo;

pub(super) fn base_info(formats: Vec<YtdlpFormat>) -> YtdlpInfo {
  YtdlpInfo {
    id: Some("v1".into()),
    title: Some("title".into()),
    uploader: None,
    uploader_id: None,
    duration: None,
    like_count: None,
    dislike_count: None,
    average_rating: None,
    view_count: None,
    comment_count: None,
    description: None,
    extractor_key: None,
    thumbnail: None,
    thumbnails: None,
    formats: Some(formats),
    type_: Some("video".into()),
    is_live: Some(false),
    entries: None,
    webpage_url: Some("https://example.com".into()),
    filesize: None,
    filesize_approx: None,
    playlist_count: None,
    chapters: None,
  }
}

pub(super) fn make_format(
  language: Option<&str>,
  language_preference: Option<i64>,
  format_note: Option<&str>,
  format: Option<&str>,
  audio_channels: Option<f64>,
  vcodec: Option<&str>,
  acodec: Option<&str>,
) -> YtdlpFormat {
  YtdlpFormat {
    format_id: Some("f1".into()),
    format: format.map(str::to_string),
    format_note: format_note.map(str::to_string),
    height: Some(1080),
    fps: Some(30.0),
    abr: None,
    audio_channels,
    language: language.map(str::to_string),
    language_preference,
    ext: Some("mp4".into()),
    vcodec: vcodec.map(str::to_string),
    acodec: acodec.map(str::to_string),
  }
}

pub(super) struct GroupFormatSpec<'a> {
  pub(super) format_id: &'a str,
  pub(super) language: Option<&'a str>,
  pub(super) language_preference: Option<i64>,
  pub(super) format_note: Option<&'a str>,
  pub(super) format: Option<&'a str>,
  pub(super) audio_channels: Option<f64>,
  pub(super) height: Option<i64>,
  pub(super) fps: Option<f64>,
  pub(super) abr: Option<f64>,
  pub(super) vcodec: Option<&'a str>,
  pub(super) acodec: Option<&'a str>,
  pub(super) ext: Option<&'a str>,
}

pub(super) fn make_group_format(spec: GroupFormatSpec<'_>) -> YtdlpFormat {
  YtdlpFormat {
    format_id: Some(spec.format_id.into()),
    format: spec.format.map(str::to_string),
    format_note: spec.format_note.map(str::to_string),
    height: spec.height,
    fps: spec.fps,
    abr: spec.abr,
    audio_channels: spec.audio_channels,
    language: spec.language.map(str::to_string),
    language_preference: spec.language_preference,
    ext: spec.ext.map(str::to_string),
    vcodec: spec.vcodec.map(str::to_string),
    acodec: spec.acodec.map(str::to_string),
  }
}
