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
    !matches!(self, AudioFormat::Wav)
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
}
