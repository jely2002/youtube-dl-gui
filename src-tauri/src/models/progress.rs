use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDestination {
  pub id: String,
  pub group_id: String,
  pub destination: MediaDestinationPath,
  pub is_merged: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDestinationPath {
  pub confidence: u32,
  pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProgress {
  pub id: String,
  pub group_id: String,
  pub category: ProgressCategory,
  pub percentage: Option<f64>,
  pub speed_bps: Option<f64>,
  pub eta_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProgressStage {
  pub id: String,
  pub group_id: String,
  pub stage: ProgressStage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProgressComplete {
  pub id: String,
  pub group_id: String,
}

#[derive(Debug, Serialize, Clone)]
pub enum ProgressEvent {
  Destination(MediaDestination),
  Progress(MediaProgress),
  StageChange(MediaProgressStage),
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq, Hash)]
pub enum ProgressCategory {
  Video,
  Audio,
  Subtitles,
  Metadata,
  Thumbnail,
  Other,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProgressStage {
  Initializing,
  Downloading,
  Merging,
  Finalizing,
}
