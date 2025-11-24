use crate::models::download::{AudioFormat, TranscodePolicy, VideoContainer};
use serde::{Deserialize, Serialize};
use std::thread;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppearanceSettings {
  pub theme: String,
  pub language: String,
}

impl Default for AppearanceSettings {
  fn default() -> Self {
    Self {
      theme: "system".into(),
      language: "system".into(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AuthSettings {
  pub cookie_file: Option<String>,
  pub cookie_browser: String,
}

impl Default for AuthSettings {
  fn default() -> Self {
    Self {
      cookie_file: None,
      cookie_browser: "none".into(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NetworkSettings {
  pub proxy: Option<String>,
  pub impersonate: String,
}

impl Default for NetworkSettings {
  fn default() -> Self {
    Self {
      proxy: None,
      impersonate: "none".into(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct InputSettings {
  pub auto_fill_clipboard: bool,
  pub prefer_video_in_mixed_links: bool,
}

impl Default for InputSettings {
  fn default() -> Self {
    Self {
      auto_fill_clipboard: true,
      prefer_video_in_mixed_links: false,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoOutputSettings {
  pub container: VideoContainer,
  pub policy: TranscodePolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputSettings {
  pub format: AudioFormat,
  pub policy: TranscodePolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSettings {
  pub video: VideoOutputSettings,
  pub audio: AudioOutputSettings,
  pub add_metadata: bool,
  pub add_thumbnail: bool,
  pub download_dir: Option<String>,
  pub file_name_template: String,
}

impl Default for OutputSettings {
  fn default() -> Self {
    Self {
      video: VideoOutputSettings {
        policy: TranscodePolicy::RemuxOnly,
        container: VideoContainer::Mp4,
      },
      audio: AudioOutputSettings {
        policy: TranscodePolicy::AllowReencode,
        format: AudioFormat::Mp3,
      },
      add_metadata: true,
      add_thumbnail: true,
      download_dir: None,
      file_name_template: "%(title).200s-(%(height)sp%(fps).0d).%(ext)s".into(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PerformanceSettings {
  pub max_concurrency: usize,
  pub split_playlist_threshold: usize,
  pub auto_load_size: bool,
}

impl Default for PerformanceSettings {
  fn default() -> Self {
    Self {
      max_concurrency: thread::available_parallelism()
        .map(|n| n.get().div_ceil(2))
        .unwrap_or(1),
      split_playlist_threshold: 50,
      auto_load_size: true,
    }
  }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SponsorBlockSettings {
  pub api_url: Option<String>,
  pub remove_parts: Vec<String>,
  pub mark_parts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SubtitleSettings {
  pub enabled: bool,
  pub include_auto_generated: bool,
  pub languages: Vec<String>,
  pub format_preference: Vec<String>,
}

impl Default for SubtitleSettings {
  fn default() -> Self {
    Self {
      enabled: false,
      include_auto_generated: false,
      languages: vec!["en".into()],
      format_preference: vec![
        "srt".into(),
        "vtt".into(),
        "ass".into(),
        "ttml".into(),
        "json".into(),
      ],
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct UpdateSettings {
  pub update_binaries: bool,
  pub update_app: bool,
}

impl Default for UpdateSettings {
  fn default() -> Self {
    Self {
      update_binaries: true,
      update_app: true,
    }
  }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Config {
  pub appearance: AppearanceSettings,
  pub auth: AuthSettings,
  pub network: NetworkSettings,
  pub input: InputSettings,
  pub output: OutputSettings,
  pub performance: PerformanceSettings,
  pub sponsor_block: SponsorBlockSettings,
  pub subtitles: SubtitleSettings,
  pub update: UpdateSettings,
}
