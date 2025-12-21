use crate::models::TrackType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PathPreferences {
  pub recent: HashMap<String, Vec<String>>,
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
