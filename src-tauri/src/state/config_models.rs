use crate::commands::NotificationKind;
use crate::models::download::{
  AudioFormat, AudioPostprocessPreset, TranscodePolicy, VideoContainer, VideoPostprocessMode,
  VideoPostprocessPreset,
};
use serde::{Deserialize, Serialize};
use std::thread;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppearanceSettings {
  pub theme: String,
  pub language: String,
  pub expanded_options: String,
}

impl Default for AppearanceSettings {
  fn default() -> Self {
    Self {
      theme: "system".into(),
      language: "system".into(),
      expanded_options: "none".into(),
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
  pub enable_proxy: Option<bool>,
  pub proxy: Option<String>,
  pub impersonate: String,
  pub extractor_args: String,
}

impl Default for NetworkSettings {
  fn default() -> Self {
    Self {
      enable_proxy: None,
      proxy: None,
      impersonate: "none".into(),
      extractor_args: String::new(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct InputSettings {
  pub auto_fill_clipboard: bool,
  pub prefer_video_in_mixed_links: bool,
  pub global_shortcuts: bool,
}

impl Default for InputSettings {
  fn default() -> Self {
    Self {
      auto_fill_clipboard: true,
      prefer_video_in_mixed_links: false,
      global_shortcuts: true,
    }
  }
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum InputFilterSizeUnit {
  #[default]
  B,
  KB,
  MB,
  GB,
  TB,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct InputFilterSizeFilter {
  pub value: Option<f64>,
  pub unit: Option<InputFilterSizeUnit>,
}

impl Default for InputFilterSizeFilter {
  fn default() -> Self {
    Self {
      value: None,
      unit: Some(InputFilterSizeUnit::MB),
    }
  }
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum InputFilterDateMode {
  #[default]
  Exact,
  Before,
  After,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct InputFilterDateFilter {
  pub mode: Option<InputFilterDateMode>,
  pub value: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct InputFilterSettings {
  pub min_size: InputFilterSizeFilter,
  pub max_size: InputFilterSizeFilter,
  pub date_filter: InputFilterDateFilter,
  pub match_filters: Option<String>,
  pub break_match_filters: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoOutputSettings {
  pub container: VideoContainer,
  pub policy: TranscodePolicy,
  pub postprocess_preset: VideoPostprocessPreset,
  pub custom_postprocess_mode: VideoPostprocessMode,
  pub postprocess_args: String,
}

impl Default for VideoOutputSettings {
  fn default() -> Self {
    Self {
      policy: TranscodePolicy::AllowReencode,
      container: VideoContainer::Mp4,
      postprocess_preset: VideoPostprocessPreset::None,
      custom_postprocess_mode: VideoPostprocessMode::Remux,
      postprocess_args: String::new(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputSettings {
  pub format: AudioFormat,
  pub policy: TranscodePolicy,
  pub postprocess_preset: AudioPostprocessPreset,
  pub postprocess_args: String,
}

impl Default for AudioOutputSettings {
  fn default() -> Self {
    Self {
      policy: TranscodePolicy::AllowReencode,
      format: AudioFormat::Mp3,
      postprocess_preset: AudioPostprocessPreset::None,
      postprocess_args: String::new(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct OutputSettings {
  pub video: VideoOutputSettings,
  pub audio: AudioOutputSettings,
  pub add_metadata: bool,
  pub add_thumbnail: bool,
  pub save_thumbnail: bool,
  pub precise_cuts: bool,
  pub reverse_playlist_numbering: bool,
  pub download_dir: Option<String>,
  pub file_name_template: String,
  pub audio_file_name_template: String,
  pub restrict_filenames: bool,
}

impl Default for OutputSettings {
  fn default() -> Self {
    Self {
      video: VideoOutputSettings::default(),
      audio: AudioOutputSettings::default(),
      add_metadata: true,
      add_thumbnail: true,
      save_thumbnail: false,
      precise_cuts: false,
      reverse_playlist_numbering: false,
      download_dir: None,
      file_name_template: "%(title).200s-(%(height)sp%(fps).0d).%(ext)s".into(),
      audio_file_name_template: "%(title).200s-(%(abr)dk).%(ext)s".into(),
      restrict_filenames: false,
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
  pub embed_subtitles: bool,
}

impl Default for SubtitleSettings {
  fn default() -> Self {
    Self {
      enabled: false,
      include_auto_generated: false,
      languages: vec!["en".into()],
      embed_subtitles: true,
      format_preference: vec![
        "srt".into(),
        "vtt".into(),
        "ass".into(),
        "ttml".into(),
        "json3".into(),
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

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CloseBehavior {
  Exit,
  Hide,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SystemConfig {
  pub tray_enabled: bool,
  pub auto_start_enabled: bool,
  pub auto_start_minimised: bool,
  pub close_behavior: CloseBehavior,
}

impl Default for SystemConfig {
  fn default() -> Self {
    #[cfg(target_os = "windows")]
    {
      Self {
        tray_enabled: false,
        auto_start_enabled: false,
        auto_start_minimised: false,
        close_behavior: CloseBehavior::Exit,
      }
    }

    #[cfg(target_os = "macos")]
    {
      Self {
        tray_enabled: false,
        auto_start_enabled: false,
        auto_start_minimised: false,
        close_behavior: CloseBehavior::Hide,
      }
    }

    #[cfg(target_os = "linux")]
    {
      Self {
        tray_enabled: false,
        auto_start_enabled: false,
        auto_start_minimised: false,
        close_behavior: CloseBehavior::Exit,
      }
    }
  }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationBehavior {
  Always,
  OnBackground,
  Never,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NotificationConfig {
  pub notification_behavior: NotificationBehavior,
  pub disabled_notifications: Vec<NotificationKind>,
}

impl Default for NotificationConfig {
  fn default() -> Self {
    Self {
      notification_behavior: NotificationBehavior::Never,
      disabled_notifications: vec![],
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
  pub input_filters: InputFilterSettings,
  pub output: OutputSettings,
  pub performance: PerformanceSettings,
  pub sponsor_block: SponsorBlockSettings,
  pub subtitles: SubtitleSettings,
  pub update: UpdateSettings,
  pub system: SystemConfig,
  pub notifications: NotificationConfig,
}
