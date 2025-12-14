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
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatOptions {
  pub track_type: TrackType,
  pub asr: Option<u32>,
  pub height: Option<u32>,
  pub fps: Option<u32>,
}
