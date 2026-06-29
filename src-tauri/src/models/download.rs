use crate::models::SubtitleInventory;
use crate::runners::template_context::TemplateContext;
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoPostprocessPreset {
  None,
  Fps30,
  Mp42,
  Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoPostprocessMode {
  Remux,
  Reencode,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioPostprocessPreset {
  None,
  Custom,
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
  #[serde(alias = "remuxOnly")]
  AllowReencode,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
  pub id: String,
  pub url: String,
  pub format: FormatOptions,
  #[serde(default)]
  pub subtitle_inventory: Option<SubtitleInventory>,
  #[serde(default)]
  pub overrides: Option<DownloadOverrides>,
  pub template_context: TemplateContext,
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
  pub input_filters: Option<InputFilterOptions>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputOverrides {
  pub video: Option<VideoOutputOverrides>,
  pub audio: Option<AudioOutputOverrides>,
  pub add_metadata: Option<bool>,
  pub add_thumbnail: Option<bool>,
  pub save_thumbnail: Option<bool>,
  pub precise_cuts: Option<bool>,
  pub reverse_playlist_numbering: Option<bool>,
  pub file_name_template: Option<String>,
  pub audio_file_name_template: Option<String>,
  pub restrict_filenames: Option<bool>,
  pub partial_download: Option<PartialDownloadOverride>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartialDownloadOverride {
  pub section: Option<DownloadSection>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSection {
  pub id: String,
  pub start: String,
  pub end: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoOutputOverrides {
  pub container: Option<VideoContainer>,
  pub policy: Option<TranscodePolicy>,
  pub postprocess_preset: Option<VideoPostprocessPreset>,
  pub custom_postprocess_mode: Option<VideoPostprocessMode>,
  pub postprocess_args: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputOverrides {
  pub format: Option<AudioFormat>,
  pub policy: Option<TranscodePolicy>,
  pub postprocess_preset: Option<AudioPostprocessPreset>,
  pub postprocess_args: Option<String>,
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
  pub extractor_args: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOverrides {
  pub enabled: Option<bool>,
  pub include_auto_generated: Option<bool>,
  pub languages: Option<Vec<String>>,
  pub manual_languages: Option<Vec<String>>,
  pub auto_languages: Option<Vec<String>>,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PlaylistMode {
  SingleVideo,
  #[default]
  Playlist,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputFilterOptions {
  pub playlist_items: Option<String>,
  pub min_filesize: Option<String>,
  pub max_filesize: Option<String>,
  pub date: Option<String>,
  pub datebefore: Option<String>,
  pub dateafter: Option<String>,
  pub match_filters: Option<String>,
  pub break_match_filters: Option<String>,
  pub playlist_mode: Option<PlaylistMode>,
}

#[cfg(test)]
mod tests {
  use super::TranscodePolicy;

  #[test]
  fn transcode_policy_deserializes_legacy_remux_only_as_allow_reencode() {
    let policy: TranscodePolicy = serde_json::from_str(r#""remuxOnly""#).unwrap();
    assert!(matches!(policy, TranscodePolicy::AllowReencode));
  }
}
