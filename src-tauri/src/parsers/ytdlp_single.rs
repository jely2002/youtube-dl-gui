use crate::models::ytdlp::YtdlpFormat;
use crate::models::{MediaFormat, MediaTrack, ParsedMedia, ParsedSingleVideo, YtdlpInfo};
use std::collections::HashSet;

pub fn parse_single(info: YtdlpInfo, id: String) -> ParsedMedia {
  let (video_codecs, audio_codecs, media_formats, audio_tracks, video_tracks) =
    if let Some(formats) = &info.formats {
      process_formats(formats)
    } else {
      (
        HashSet::new(),
        HashSet::new(),
        Vec::new(),
        vec![auto_track()],
        vec![auto_track()],
      )
    };

  let detected = media_formats.len();
  let provided = info.formats.as_ref().map_or(0, Vec::len);
  let loss_pct = if provided == 0 {
    0.0
  } else {
    100.0 * (provided - detected) as f64 / provided as f64
  };

  tracing::debug!(
    "Detected unique formats: {} out of {} provided ({:.1}% filtered).",
    detected,
    provided,
    loss_pct,
  );

  ParsedMedia::Single(ParsedSingleVideo {
    id,
    url: info.webpage_url,
    title: info.title,
    thumbnail: info.thumbnail,
    uploader: info.uploader,
    uploader_id: info.uploader_id,
    duration: info.duration,
    views: i64_to_u64(info.view_count),
    likes: i64_to_u64(info.like_count),
    dislikes: i64_to_u64(info.dislike_count),
    rating: info.average_rating,
    description: info.description,
    extractor: info.extractor_key,
    comments: i64_to_u64(info.comment_count),
    filesize: i64_to_u64(info.filesize.or(info.filesize_approx)),
    video_codecs: video_codecs.into_iter().collect(),
    audio_codecs: audio_codecs.into_iter().collect(),
    video_tracks,
    audio_tracks,
    formats: media_formats,
  })
}

fn process_formats(
  formats: &[YtdlpFormat],
) -> (
  HashSet<String>,
  HashSet<String>,
  Vec<MediaFormat>,
  Vec<MediaTrack>,
  Vec<MediaTrack>,
) {
  let mut video_codecs = HashSet::new();
  let mut audio_codecs = HashSet::new();
  let mut media_formats = Vec::new();
  let mut audio_tracks = Vec::new();
  let mut video_tracks = Vec::new();
  let mut detected = HashSet::new();
  let mut detected_audio_tracks = HashSet::new();
  let mut detected_video_tracks = HashSet::new();

  for fmt in formats {
    if let Some(vc) = &fmt.vcodec {
      if is_real_video_codec(vc) {
        video_codecs.insert(vc.clone());
      }
    }
    if let Some(ac) = &fmt.acodec {
      if ac != "none" {
        audio_codecs.insert(ac.clone());
      }
    }

    if has_audio_stream(fmt) {
      let track = to_track(fmt);
      if detected_audio_tracks.insert(track.id.clone()) {
        audio_tracks.push(track);
      }
    }

    if has_video_stream(fmt) {
      let track = to_track(fmt);
      if detected_video_tracks.insert(track.id.clone()) {
        video_tracks.push(track);
      }
    }
  }

  for fmt in formats {
    if fmt.ext.as_deref() == Some("mhtml") {
      continue;
    }

    let mut abr_norm = fmt.abr;
    if matches!(abr_norm, Some(a) if a == 0.0) {
      abr_norm = None;
    }

    let mut fps_norm = fmt.fps;
    if matches!(fps_norm, Some(f) if f == 0.0) {
      fps_norm = None;
    }

    let (format_id, height, abr, fps) = match (&fmt.format_id, fmt.height, abr_norm, fps_norm) {
      (Some(format_id), Some(height), None, fps) => {
        let fps_rounded = fps.map(|f| f.round() as u64);
        (format_id.clone(), Some(height), None, fps_rounded)
      }
      (Some(format_id), None, Some(abr), None) => {
        let abr_rounded = abr.round() as u64;
        (format_id.clone(), None, Some(abr_rounded), None)
      }
      _ => continue,
    };

    let key = if let Some(h) = height {
      let fps_key = fps.map_or_else(|| "none".into(), |f| f.to_string());
      format!("{h}x{fps_key}")
    } else {
      abr.map_or_else(|| "none".into(), |a| a.to_string())
    };

    tracing::trace!("Detected format: {:?}", (format_id.clone(), key.clone()));
    if detected.contains(&key) {
      continue;
    }

    let codecs = collect_codecs_for_group(formats, height, fps, abr);

    media_formats.push(MediaFormat {
      id: format_id.clone(),
      abr,
      height: i64_to_u64(height),
      fps,
      codecs: codecs.into_iter().collect(),
    });

    detected.insert(key);
  }

  if audio_tracks.is_empty() {
    audio_tracks.push(auto_track());
  }
  if video_tracks.is_empty() {
    video_tracks.push(auto_track());
  }

  sort_tracks(&mut audio_tracks);
  sort_tracks(&mut video_tracks);

  (
    video_codecs,
    audio_codecs,
    media_formats,
    audio_tracks,
    video_tracks,
  )
}

#[allow(clippy::cast_possible_truncation)]
fn collect_codecs_for_group(
  formats: &[YtdlpFormat],
  height: Option<i64>,
  fps: Option<u64>,
  abr: Option<u64>,
) -> HashSet<String> {
  let mut codecs = HashSet::new();

  for other in formats {
    let is_match = if let Some(h) = height {
      other.height == Some(h)
        && ((fps.is_none() && other.fps.is_none()) || other.fps.map(|f| f.round() as u64) == fps)
    } else if let Some(a) = abr {
      other.abr.map(|x| x.round() as u64) == Some(a)
    } else {
      false
    };

    if !is_match {
      continue;
    }

    if let Some(vc) = &other.vcodec {
      if vc != "none" {
        codecs.insert(vc.clone());
      }
    }
    if let Some(ac) = &other.acodec {
      if ac != "none" {
        codecs.insert(ac.clone());
      }
    }
  }

  codecs
}

pub fn i64_to_u64(v: Option<i64>) -> Option<u64> {
  v.and_then(|x| u64::try_from(x).ok())
}

fn has_audio_stream(fmt: &YtdlpFormat) -> bool {
  fmt.acodec.as_deref().is_some_and(|ac| ac != "none")
}

fn has_video_stream(fmt: &YtdlpFormat) -> bool {
  if is_storyboard_format(fmt) {
    return false;
  }
  fmt.vcodec.as_deref().is_some_and(is_real_video_codec) || fmt.height.is_some()
}

fn normalize_text(v: &Option<String>) -> Option<String> {
  v.as_ref()
    .map(|s| s.trim())
    .filter(|s| !s.is_empty())
    .map(ToOwned::to_owned)
}

fn to_track(fmt: &YtdlpFormat) -> MediaTrack {
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

fn is_storyboard_format(fmt: &YtdlpFormat) -> bool {
  let note = fmt
    .format_note
    .as_deref()
    .unwrap_or_default()
    .to_lowercase();
  let format = fmt.format.as_deref().unwrap_or_default().to_lowercase();
  note.contains("storyboard") || format.contains("storyboard")
}

fn is_real_video_codec(vc: &str) -> bool {
  let lower = vc.trim().to_lowercase();
  lower != "none" && lower != "images"
}

fn auto_track() -> MediaTrack {
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

fn sort_tracks(tracks: &mut [MediaTrack]) {
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

#[cfg(test)]
mod tests {
  use super::*;
  use crate::models::{ParsedMedia, YtdlpInfo};

  fn base_info(formats: Vec<YtdlpFormat>) -> YtdlpInfo {
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
    }
  }

  fn make_format(
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

  #[test]
  fn parse_single_extracts_rich_tracks() {
    let info = base_info(vec![
      make_format(
        Some("en"),
        Some(10),
        Some("main"),
        Some("1080p"),
        Some(2.0),
        Some("avc1"),
        Some("aac"),
      ),
      make_format(
        Some("en"),
        Some(10),
        Some("commentary"),
        Some("1080p"),
        Some(2.0),
        Some("avc1"),
        Some("aac"),
      ),
    ]);

    let ParsedMedia::Single(single) = parse_single(info, "id1".into()) else {
      panic!("expected single");
    };

    assert_eq!(single.audio_tracks.len(), 1);
    assert_eq!(single.video_tracks.len(), 1);
    assert_eq!(single.audio_tracks[0].label, "en - 2ch");
  }

  #[test]
  fn parse_single_ignores_quality_notes_in_track_identity() {
    let info = base_info(vec![
      make_format(
        Some("en-us"),
        Some(10),
        Some("1080p"),
        Some("1080p"),
        Some(2.0),
        Some("avc1"),
        Some("aac"),
      ),
      make_format(
        Some("en-us"),
        Some(10),
        Some("720p"),
        Some("720p"),
        Some(2.0),
        Some("avc1"),
        Some("aac"),
      ),
    ]);

    let ParsedMedia::Single(single) = parse_single(info, "id-q".into()) else {
      panic!("expected single");
    };

    assert_eq!(single.audio_tracks.len(), 1);
    assert_eq!(single.audio_tracks[0].label, "en-us - 2ch");
  }

  #[test]
  fn parse_single_filters_storyboard_tracks() {
    let info = base_info(vec![YtdlpFormat {
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
    }]);

    let ParsedMedia::Single(single) = parse_single(info, "id-sb".into()) else {
      panic!("expected single");
    };

    assert_eq!(single.video_tracks.len(), 1);
    assert_eq!(single.video_tracks[0].id, "auto");
  }

  #[test]
  fn parse_single_collects_codecs_from_muxed_formats() {
    let info = base_info(vec![make_format(
      Some("en"),
      Some(1),
      Some("main"),
      Some("1080p"),
      Some(2.0),
      Some("avc1"),
      Some("mp4a.40.2"),
    )]);

    let ParsedMedia::Single(single) = parse_single(info, "id-codecs".into()) else {
      panic!("expected single");
    };

    assert!(single.video_codecs.iter().any(|codec| codec == "avc1"));
    assert!(single.audio_codecs.iter().any(|codec| codec == "mp4a.40.2"));
  }

  #[test]
  fn parse_single_dedupes_tracks_and_keeps_auto_fallback() {
    let info = base_info(vec![
      make_format(None, None, None, None, None, Some("none"), Some("aac")),
      make_format(None, None, None, None, None, Some("none"), Some("aac")),
    ]);

    let ParsedMedia::Single(single) = parse_single(info, "id2".into()) else {
      panic!("expected single");
    };

    assert_eq!(single.audio_tracks.len(), 1);
    assert_eq!(single.audio_tracks[0].id, "auto");
    assert_eq!(single.video_tracks.len(), 1);
    assert_eq!(single.video_tracks[0].id, "auto");
  }

  #[test]
  fn parse_single_without_formats_adds_auto_tracks() {
    let info = YtdlpInfo {
      id: Some("v2".into()),
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
      formats: None,
      type_: Some("video".into()),
      is_live: Some(false),
      entries: None,
      webpage_url: Some("https://example.com".into()),
      filesize: None,
      filesize_approx: None,
      playlist_count: None,
    };

    let ParsedMedia::Single(single) = parse_single(info, "id3".into()) else {
      panic!("expected single");
    };

    assert_eq!(single.audio_tracks.len(), 1);
    assert_eq!(single.audio_tracks[0].id, "auto");
    assert_eq!(single.video_tracks.len(), 1);
    assert_eq!(single.video_tracks[0].id, "auto");
  }
}
