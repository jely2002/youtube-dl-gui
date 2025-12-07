use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct YtdlpInfo {
  pub title: Option<String>,
  pub uploader: Option<String>,
  pub uploader_id: Option<String>,
  pub duration: Option<u64>,
  pub like_count: Option<u64>,
  pub dislike_count: Option<u64>,
  pub average_rating: Option<f64>,
  pub view_count: Option<u64>,
  pub comment_count: Option<u64>,
  pub description: Option<String>,
  pub extractor_key: Option<String>,
  pub thumbnail: Option<String>,
  pub thumbnails: Option<Vec<YtdlpThumbnail>>,
  pub formats: Option<Vec<YtdlpFormat>>,
  #[serde(rename = "type_")]
  pub type_: Option<String>,
  pub is_live: Option<bool>,
  pub entries: Option<Vec<YtdlpEntry>>,
  pub webpage_url: Option<String>,
  pub filesize: Option<u64>,
  pub filesize_approx: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct YtdlpThumbnail {
  pub url: Option<String>,
  pub width: Option<u32>,
  pub height: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct YtdlpEntry {
  pub url: Option<String>,
  pub webpage_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct YtdlpFormat {
  pub format_id: Option<String>,
  pub height: Option<u64>,
  pub fps: Option<f64>,
  pub asr: Option<f64>,
  pub ext: Option<String>,
  pub vcodec: Option<String>,
  pub acodec: Option<String>,
}
