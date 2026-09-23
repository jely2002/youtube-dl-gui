use crate::models::{ParsedMedia, YtdlpInfo};
use crate::parsers::ytdlp_livestream::parse_livestream;
use crate::parsers::ytdlp_playlist::parse_playlist;
use crate::parsers::ytdlp_single::parse_single;

pub enum InfoType {
  Single,
  Playlist,
  Livestream,
}

pub fn parse_ytdlp_info(json: &str, id: String) -> Result<ParsedMedia, String> {
  let info: YtdlpInfo = serde_json::from_str(json).map_err(|e| format!("JSON parse error: {e}"))?;

  Ok(match detect_info_type(&info) {
    InfoType::Livestream => parse_livestream(info, id),
    InfoType::Playlist => parse_playlist(info, id),
    InfoType::Single => parse_single(info, id),
  })
}

/// Selecting one item of a playlist URL with `-I` still makes yt-dlp wrap it in a playlist.
/// Returns the JSON of that single, fully extracted item so it can be parsed as a video.
pub fn unwrap_selected_playlist_entry(json: &str) -> Option<String> {
  let value: serde_json::Value = serde_json::from_str(json).ok()?;
  if value.get("_type")?.as_str()? != "playlist" {
    return None;
  }
  match value.get("entries")?.as_array()?.as_slice() {
    [entry] if entry.get("formats").is_some() => serde_json::to_string(entry).ok(),
    _ => None,
  }
}

pub fn detect_info_type(info: &YtdlpInfo) -> InfoType {
  if info.is_live.unwrap_or(false) {
    InfoType::Livestream
  } else if info.type_.as_deref() == Some("playlist")
    || info.entries.as_ref().is_some_and(|e| !e.is_empty())
  {
    InfoType::Playlist
  } else {
    InfoType::Single
  }
}

#[cfg(test)]
mod tests {
  use super::{parse_ytdlp_info, unwrap_selected_playlist_entry};
  use crate::models::ParsedMedia;

  const POST_URL: &str = "https://twitter.com/user/status/1577719286659006464";

  fn playlist_entries(json: &str) -> Vec<(String, usize, Option<u64>)> {
    match parse_ytdlp_info(json, "id".into()).unwrap() {
      ParsedMedia::Playlist(playlist) => playlist
        .entries
        .into_iter()
        .map(|entry| (entry.video_url, entry.index, entry.playlist_item))
        .collect(),
      _ => panic!("expected a playlist"),
    }
  }

  #[test]
  fn playlist_entries_without_own_url_select_item_from_playlist_url() {
    // Shape of `yt-dlp -J --flat-playlist` for a post with several videos.
    let json = format!(
      r#"{{"_type": "playlist", "webpage_url": "{POST_URL}", "entries": [
        {{"id": "a", "url": null, "webpage_url": "{POST_URL}", "playlist_index": 1}},
        {{"id": "b", "url": null, "webpage_url": "{POST_URL}", "playlist_index": 2}}
      ]}}"#
    );

    assert_eq!(
      playlist_entries(&json),
      vec![
        (POST_URL.to_string(), 0, Some(1)),
        (POST_URL.to_string(), 1, Some(2)),
      ]
    );
  }

  #[test]
  fn playlist_entries_with_own_url_are_unchanged() {
    let json = r#"{"_type": "playlist", "webpage_url": "https://example.com/list", "entries": [
      {"url": "https://example.com/watch?v=1", "webpage_url": null},
      {"url": null, "webpage_url": "https://example.com/watch?v=2"}
    ]}"#;

    assert_eq!(
      playlist_entries(json),
      vec![
        ("https://example.com/watch?v=1".to_string(), 0, None),
        ("https://example.com/watch?v=2".to_string(), 1, None),
      ]
    );
  }

  #[test]
  fn unwraps_single_selected_playlist_entry() {
    let json = format!(
      r#"{{"_type": "playlist", "webpage_url": "{POST_URL}", "entries": [
        {{"id": "b", "title": "Video 2", "webpage_url": "{POST_URL}", "formats": []}}
      ]}}"#
    );

    let entry = unwrap_selected_playlist_entry(&json).expect("selected entry");
    match parse_ytdlp_info(&entry, "id".into()).unwrap() {
      ParsedMedia::Single(single) => {
        assert_eq!(single.title.as_deref(), Some("Video 2"));
        assert_eq!(single.url.as_deref(), Some(POST_URL));
      }
      _ => panic!("expected a single video"),
    }
  }

  #[test]
  fn does_not_unwrap_real_playlists_or_single_videos() {
    let playlist = r#"{"_type": "playlist", "entries": [{"formats": []}, {"formats": []}]}"#;
    let flat_entry = r#"{"_type": "playlist", "entries": [{"url": "https://example.com/1"}]}"#;
    let single = r#"{"_type": "video", "formats": []}"#;

    assert!(unwrap_selected_playlist_entry(playlist).is_none());
    assert!(unwrap_selected_playlist_entry(flat_entry).is_none());
    assert!(unwrap_selected_playlist_entry(single).is_none());
  }
}
