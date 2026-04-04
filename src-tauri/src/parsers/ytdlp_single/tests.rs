use super::parse_single;
use super::test_support::{base_info, make_format};
use crate::models::{ParsedMedia, YtdlpInfo};

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

  assert!(single
    .video_codecs
    .iter()
    .any(|codec| codec.id == "avc1" && codec.label == "avc1"));
  assert!(single
    .audio_codecs
    .iter()
    .any(|codec| codec.id == "mp4a.40.2" && codec.label == "AAC LC"));
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
    chapters: None,
  };

  let ParsedMedia::Single(single) = parse_single(info, "id3".into()) else {
    panic!("expected single");
  };

  assert_eq!(single.audio_tracks.len(), 1);
  assert_eq!(single.audio_tracks[0].id, "auto");
  assert_eq!(single.video_tracks.len(), 1);
  assert_eq!(single.video_tracks[0].id, "auto");
}
