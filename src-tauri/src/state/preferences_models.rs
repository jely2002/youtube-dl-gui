use crate::models::TrackType;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PathPreferences {
  pub audio_download_dir: Option<String>,
  pub video_download_dir: Option<String>,
  pub video_directory_template: String,
  pub audio_directory_template: String,
}

impl Default for PathPreferences {
  fn default() -> Self {
    Self {
      audio_download_dir: None,
      video_download_dir: None,
      video_directory_template: "".to_string(),
      audio_directory_template: "".to_string(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RecentPreferences {
  pub recent: IndexMap<String, Vec<String>>,
}

impl Default for RecentPreferences {
  fn default() -> Self {
    Self {
      recent: IndexMap::new(),
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

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WindowPreferences {
  pub width: u32,
  pub height: u32,
  pub maximized: bool,
  pub x: i32,
  pub y: i32,
  pub prev_x: i32,
  pub prev_y: i32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Preferences {
  pub paths: PathPreferences,
  pub recents: RecentPreferences,
  pub formats: FormatPreferences,
  pub window: WindowPreferences,
}
