use crate::models::TrackType;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PathPreferences {
  pub recent: IndexMap<String, Vec<String>>,
  pub audio_download_dir: Option<String>,
  pub video_download_dir: Option<String>,
  pub video_directory_template: String,
  pub audio_directory_template: String,
}

impl Default for PathPreferences {
  fn default() -> Self {
    Self {
      recent: IndexMap::new(),
      audio_download_dir: None,
      video_download_dir: None,
      video_directory_template: "".to_string(),
      audio_directory_template: "".to_string(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct FormatPreferences {
  pub track_type: TrackType,
}

impl Default for FormatPreferences {
  fn default() -> Self {
    Self {
      track_type: TrackType::Both,
    }
  }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Preferences {
  pub paths: PathPreferences,
  pub formats: FormatPreferences,
}
