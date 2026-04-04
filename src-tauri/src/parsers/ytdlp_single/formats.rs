use super::codecs::{insert_codec, sort_codecs};
use super::common::i64_to_u64;
use super::tracks::{
  auto_track, has_audio_stream, has_video_stream, is_real_video_codec, sort_tracks, to_track,
};
use crate::models::ytdlp::YtdlpFormat;
use crate::models::{MediaCodec, MediaFormat, MediaTrack};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

pub(super) struct ProcessedFormats {
  pub(super) video_codecs: Vec<MediaCodec>,
  pub(super) audio_codecs: Vec<MediaCodec>,
  pub(super) media_formats: Vec<MediaFormat>,
  pub(super) audio_tracks: Vec<MediaTrack>,
  pub(super) video_tracks: Vec<MediaTrack>,
}

struct FormatAggregate {
  id: String,
  abr: Option<u64>,
  height: Option<u64>,
  fps: Option<u64>,
  video_codecs: HashMap<String, MediaCodec>,
  audio_track_ids: HashSet<String>,
  video_track_ids: HashSet<String>,
}

struct FormatGroupInfo {
  key: String,
  id: String,
  abr: Option<u64>,
  height: Option<u64>,
  fps: Option<u64>,
}

pub(super) fn process_formats(formats: &[YtdlpFormat]) -> ProcessedFormats {
  let mut video_codecs: HashMap<String, MediaCodec> = HashMap::new();
  let mut audio_codecs: HashMap<String, MediaCodec> = HashMap::new();
  let mut audio_tracks = Vec::new();
  let mut video_tracks = Vec::new();
  let mut detected_audio_tracks = HashSet::new();
  let mut detected_video_tracks = HashSet::new();
  let mut aggregates: HashMap<String, FormatAggregate> = HashMap::new();

  for fmt in formats {
    if let Some(vc) = &fmt.vcodec {
      if is_real_video_codec(vc) {
        insert_codec(&mut video_codecs, vc);
      }
    }
    if let Some(ac) = &fmt.acodec {
      if ac != "none" {
        insert_codec(&mut audio_codecs, ac);
      }
    }

    let audio_track = has_audio_stream(fmt).then(|| to_track(fmt));
    let video_track = has_video_stream(fmt).then(|| to_track(fmt));

    if let Some(track) = &audio_track {
      if detected_audio_tracks.insert(track.id.clone()) {
        audio_tracks.push(track.clone());
      }
    }

    if let Some(track) = &video_track {
      if detected_video_tracks.insert(track.id.clone()) {
        video_tracks.push(track.clone());
      }
    }

    if let Some(group) = detect_format_group(fmt) {
      let entry = aggregates
        .entry(group.key.clone())
        .or_insert_with(|| FormatAggregate {
          id: group.id.clone(),
          abr: group.abr,
          height: group.height,
          fps: group.fps,
          video_codecs: HashMap::new(),
          audio_track_ids: HashSet::new(),
          video_track_ids: HashSet::new(),
        });

      if let Some(vc) = &fmt.vcodec {
        if is_real_video_codec(vc) {
          insert_codec(&mut entry.video_codecs, vc);
        }
      }
      if let Some(track) = &audio_track {
        if track.id != "auto" {
          entry.audio_track_ids.insert(track.id.clone());
        }
      }
      if let Some(track) = &video_track {
        if track.id != "auto" {
          entry.video_track_ids.insert(track.id.clone());
        }
      }
    }
  }

  if audio_tracks.is_empty() {
    audio_tracks.push(auto_track());
  }
  if video_tracks.is_empty() {
    video_tracks.push(auto_track());
  }

  sort_tracks(&mut audio_tracks);
  sort_tracks(&mut video_tracks);

  let mut media_formats: Vec<MediaFormat> = aggregates
    .into_values()
    .map(|agg| {
      let video_codecs = sort_codecs(agg.video_codecs.into_values().collect());
      let mut audio_track_ids = agg.audio_track_ids.into_iter().collect::<Vec<_>>();
      audio_track_ids.sort();
      let mut video_track_ids = agg.video_track_ids.into_iter().collect::<Vec<_>>();
      video_track_ids.sort();

      MediaFormat {
        id: agg.id,
        abr: agg.abr,
        height: agg.height,
        fps: agg.fps,
        video_codecs,
        audio_track_ids,
        video_track_ids,
      }
    })
    .collect();
  media_formats.sort_by(sort_media_format);

  ProcessedFormats {
    video_codecs: sort_codecs(video_codecs.into_values().collect()),
    audio_codecs: sort_codecs(audio_codecs.into_values().collect()),
    media_formats,
    audio_tracks,
    video_tracks,
  }
}

fn detect_format_group(fmt: &YtdlpFormat) -> Option<FormatGroupInfo> {
  if fmt.ext.as_deref() == Some("mhtml") {
    return None;
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
    _ => return None,
  };

  let key = if let Some(h) = height {
    let fps_key = fps.map_or_else(|| "none".into(), |f| f.to_string());
    format!("{h}x{fps_key}")
  } else {
    abr.map_or_else(|| "none".into(), |a| a.to_string())
  };

  tracing::trace!("Detected format: {:?}", (format_id.clone(), key.clone()));
  Some(FormatGroupInfo {
    key,
    id: format_id,
    abr,
    height: i64_to_u64(height),
    fps,
  })
}

fn sort_media_format(a: &MediaFormat, b: &MediaFormat) -> Ordering {
  match (a.height, b.height) {
    (Some(ah), Some(bh)) => bh
      .cmp(&ah)
      .then_with(|| b.fps.unwrap_or(0).cmp(&a.fps.unwrap_or(0)))
      .then_with(|| a.id.cmp(&b.id)),
    (Some(_), None) => Ordering::Less,
    (None, Some(_)) => Ordering::Greater,
    (None, None) => match (a.abr, b.abr) {
      (Some(aa), Some(ba)) => ba.cmp(&aa).then_with(|| a.id.cmp(&b.id)),
      (Some(_), None) => Ordering::Less,
      (None, Some(_)) => Ordering::Greater,
      (None, None) => a.id.cmp(&b.id),
    },
  }
}

#[cfg(test)]
mod tests {
  use super::super::test_support::{make_format, make_group_format, GroupFormatSpec};
  use super::process_formats;
  use crate::models::ytdlp::YtdlpFormat;

  #[test]
  fn collects_per_group_track_ids() {
    let processed = process_formats(&[
      make_group_format(GroupFormatSpec {
        format_id: "1080p-main",
        language: Some("en"),
        language_preference: Some(10),
        format_note: Some("main"),
        format: Some("1080p"),
        audio_channels: Some(2.0),
        height: Some(1080),
        fps: Some(30.0),
        abr: None,
        vcodec: Some("avc1"),
        acodec: Some("aac"),
        ext: Some("mp4"),
      }),
      make_group_format(GroupFormatSpec {
        format_id: "1080p-alt",
        language: Some("fr"),
        language_preference: Some(8),
        format_note: Some("alt"),
        format: Some("1080p"),
        audio_channels: Some(2.0),
        height: Some(1080),
        fps: Some(30.0),
        abr: None,
        vcodec: Some("avc1"),
        acodec: Some("aac"),
        ext: Some("mp4"),
      }),
      make_group_format(GroupFormatSpec {
        format_id: "720p-main",
        language: Some("en"),
        language_preference: Some(10),
        format_note: Some("main"),
        format: Some("720p"),
        audio_channels: Some(2.0),
        height: Some(720),
        fps: Some(30.0),
        abr: None,
        vcodec: Some("avc1"),
        acodec: Some("aac"),
        ext: Some("mp4"),
      }),
    ]);

    let fmt1080 = processed
      .media_formats
      .iter()
      .find(|fmt| fmt.height == Some(1080))
      .expect("1080p");
    assert!(fmt1080
      .audio_track_ids
      .iter()
      .any(|id| id == "lang:en|channels:2"));
    assert!(fmt1080
      .audio_track_ids
      .iter()
      .any(|id| id == "lang:fr|channels:2"));
    assert!(fmt1080
      .video_track_ids
      .iter()
      .any(|id| id == "lang:en|channels:2"));
    assert!(fmt1080
      .video_track_ids
      .iter()
      .any(|id| id == "lang:fr|channels:2"));

    let fmt720 = processed
      .media_formats
      .iter()
      .find(|fmt| fmt.height == Some(720))
      .expect("720p");
    assert_eq!(
      fmt720.audio_track_ids,
      vec!["lang:en|channels:2".to_string()]
    );
    assert_eq!(
      fmt720.video_track_ids,
      vec!["lang:en|channels:2".to_string()]
    );
  }

  #[test]
  fn groups_audio_only_formats_by_abr() {
    let processed = process_formats(&[
      make_group_format(GroupFormatSpec {
        format_id: "128k-en",
        language: Some("en"),
        language_preference: Some(10),
        format_note: Some("audio"),
        format: Some("audio"),
        audio_channels: Some(2.0),
        height: None,
        fps: None,
        abr: Some(128.0),
        vcodec: Some("none"),
        acodec: Some("aac"),
        ext: Some("m4a"),
      }),
      make_group_format(GroupFormatSpec {
        format_id: "128k-fr",
        language: Some("fr"),
        language_preference: Some(8),
        format_note: Some("audio"),
        format: Some("audio"),
        audio_channels: Some(2.0),
        height: None,
        fps: None,
        abr: Some(128.0),
        vcodec: Some("none"),
        acodec: Some("aac"),
        ext: Some("m4a"),
      }),
    ]);

    let fmt128 = processed
      .media_formats
      .iter()
      .find(|fmt| fmt.abr == Some(128))
      .expect("128k");
    assert!(fmt128.height.is_none());
    assert!(fmt128
      .audio_track_ids
      .iter()
      .any(|id| id == "lang:en|channels:2"));
    assert!(fmt128
      .audio_track_ids
      .iter()
      .any(|id| id == "lang:fr|channels:2"));
    assert!(fmt128.video_track_ids.is_empty());
  }

  #[test]
  fn keeps_empty_track_ids_when_no_real_tracks_exist() {
    let processed = process_formats(&[YtdlpFormat {
      format_id: Some("empty".into()),
      format: Some("1080p".into()),
      format_note: Some("1080p".into()),
      height: Some(1080),
      fps: Some(30.0),
      abr: None,
      audio_channels: None,
      language: None,
      language_preference: None,
      ext: Some("mp4".into()),
      vcodec: Some("none".into()),
      acodec: Some("none".into()),
    }]);

    let fmt = processed.media_formats.first().expect("format");
    assert!(fmt.audio_track_ids.is_empty());
    assert!(fmt.video_track_ids.is_empty());
    assert_eq!(processed.audio_tracks.len(), 1);
    assert_eq!(processed.video_tracks.len(), 1);
  }

  #[test]
  fn dedupes_tracks_and_keeps_auto_fallback() {
    let processed = process_formats(&[
      make_format(None, None, None, None, None, Some("none"), Some("aac")),
      make_format(None, None, None, None, None, Some("none"), Some("aac")),
    ]);

    assert_eq!(processed.audio_tracks.len(), 1);
    assert_eq!(processed.audio_tracks[0].id, "auto");
    assert_eq!(processed.video_tracks.len(), 1);
    assert_eq!(processed.video_tracks[0].id, "auto");
  }

  #[test]
  fn filters_storyboard_formats_from_aggregates() {
    let processed = process_formats(&[YtdlpFormat {
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

    assert!(processed.media_formats.is_empty());
    assert_eq!(processed.video_tracks.len(), 1);
    assert_eq!(processed.video_tracks[0].id, "auto");
  }
}
