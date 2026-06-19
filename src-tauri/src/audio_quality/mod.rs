mod decode;
mod metrics;

use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioQualityResult {
  pub score: u8,
  pub passed: bool,
  pub sample_rate: u32,
  pub max_frequency_hz: f32,
  pub dynamic_range_db: f32,
  pub noise_floor_rms: f32,
  pub clipping_detected: bool,
  pub issues: Vec<String>,
}

pub fn analyze_audio_file(path: &Path) -> Result<AudioQualityResult, String> {
  let decoded = decode::decode_to_mono_samples(path).map_err(|e| e.to_string())?;

  let clipping_detected = metrics::detect_clipping(&decoded.samples);
  let max_frequency_hz = metrics::estimate_max_frequency(&decoded.samples, decoded.sample_rate);
  let dynamic_range_db = metrics::estimate_dynamic_range_db(&decoded.samples);
  let noise_floor_rms = metrics::estimate_noise_floor_rms(&decoded.samples, decoded.sample_rate);

  let (score, issues) = metrics::score_and_issues(
    clipping_detected,
    max_frequency_hz,
    dynamic_range_db,
    noise_floor_rms,
  );
  let passed = score >= 60 && !clipping_detected;

  Ok(AudioQualityResult {
    score,
    passed,
    sample_rate: decoded.sample_rate,
    max_frequency_hz,
    dynamic_range_db,
    noise_floor_rms,
    clipping_detected,
    issues,
  })
}
