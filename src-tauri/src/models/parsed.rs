use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ParsedMedia {
  Single(ParsedSingleVideo),
  Playlist(ParsedPlaylist),
  Livestream(ParsedLivestream),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFormat {
  pub id: String,
  pub asr: Option<u64>,
  pub height: Option<u64>,
  pub fps: Option<u64>,
  pub codecs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSingleVideo {
  pub id: String,
  pub url: Option<String>,
  pub title: Option<String>,
  pub thumbnail: Option<String>,
  pub description: Option<String>,
  pub uploader_id: Option<String>,
  pub uploader: Option<String>,
  pub views: Option<u64>,
  pub comments: Option<u64>,
  pub likes: Option<u64>,
  pub dislikes: Option<u64>,
  pub duration: Option<u64>,
  pub rating: Option<f64>,
  pub extractor: Option<String>,
  pub video_codecs: Vec<String>,
  pub audio_codecs: Vec<String>,
  pub formats: Vec<MediaFormat>,
  pub filesize: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPlaylist {
  pub id: String,
  pub url: Option<String>,
  pub title: Option<String>,
  pub thumbnail: Option<String>,
  pub uploader: Option<String>,
  pub uploader_id: Option<String>,
  pub entries: Vec<PlaylistEntry>,
  pub playlist_id: Option<String>,
  pub playlist_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntry {
  pub video_url: String,
  pub index: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLivestream {
  pub id: String,
  pub url: Option<String>,
  pub title: Option<String>,
  pub uploader: Option<String>,
}
