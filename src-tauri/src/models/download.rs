use crate::runners::template_context::TemplateContext;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
  Both,
  Audio,
  Video,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoContainer {
  Mp4,
  Mkv,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioFormat {
  Mp3,
  M4a,
  Opus,
  Aac,
  Ogg,
  Flac,
  Wav,
}

impl AudioFormat {
  pub fn supports_embedded_thumbnail(&self) -> bool {
    matches!(
      self,
      AudioFormat::Mp3
        | AudioFormat::M4a
        | AudioFormat::Opus
        | AudioFormat::Ogg
        | AudioFormat::Flac
    )
  }
  pub fn supports_audio_quality_selection(&self) -> bool {
    matches!(
      self,
      AudioFormat::Mp3 | AudioFormat::M4a | AudioFormat::Aac | AudioFormat::Ogg | AudioFormat::Opus
    )
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TranscodePolicy {
  Never,
  RemuxOnly,
  AllowReencode,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
  pub id: String,
  pub url: String,
  pub format: FormatOptions,
  #[serde(default)]
  pub overrides: Option<DownloadOverrides>,
  pub template_context: TemplateContext,
  pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatOptions {
  pub track_type: TrackType,
  pub abr: Option<u32>,
  pub height: Option<u32>,
  pub fps: Option<u32>,
  pub audio_encoding: Option<String>,
  pub video_encoding: Option<String>,
  pub audio_track: Option<String>,
  pub video_track: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOverrides {
  pub output: Option<OutputOverrides>,
  pub auth: Option<AuthOverrides>,
  pub network: Option<NetworkOverrides>,
  pub subtitles: Option<SubtitleOverrides>,
  pub sponsor_block: Option<SponsorBlockOverrides>,
  pub input: Option<InputOverrides>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputOverrides {
  pub video: Option<VideoOutputOverrides>,
  pub audio: Option<AudioOutputOverrides>,
  pub add_metadata: Option<bool>,
  pub add_thumbnail: Option<bool>,
  pub file_name_template: Option<String>,
  pub audio_file_name_template: Option<String>,
  pub restrict_filenames: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoOutputOverrides {
  pub container: Option<VideoContainer>,
  pub policy: Option<TranscodePolicy>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputOverrides {
  pub format: Option<AudioFormat>,
  pub policy: Option<TranscodePolicy>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthOverrides {
  pub cookie_file: Option<String>,
  pub cookie_browser: Option<String>,
  pub username: Option<String>,
  pub password: Option<String>,
  pub video_password: Option<String>,
  pub bearer_token: Option<String>,
  pub headers: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkOverrides {
  pub enable_proxy: Option<bool>,
  pub proxy: Option<String>,
  pub impersonate: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOverrides {
  pub enabled: Option<bool>,
  pub include_auto_generated: Option<bool>,
  pub languages: Option<Vec<String>>,
  pub format_preference: Option<Vec<String>>,
  pub embed_subtitles: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SponsorBlockOverrides {
  pub api_url: Option<String>,
  pub remove_parts: Option<Vec<String>>,
  pub mark_parts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputOverrides {
  pub prefer_video_in_mixed_links: Option<bool>,
}
