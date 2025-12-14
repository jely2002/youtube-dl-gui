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
