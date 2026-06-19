use rustfft::num_complex::Complex;
use rustfft::FftPlanner;

const CLIPPING_THRESHOLD: f32 = 0.999;
const CLIPPING_RATIO: f64 = 0.001;

const FFT_SIZE: usize = 2048;
const HOP_SIZE: usize = 1024;
const FREQUENCY_ENERGY_RATIO: f64 = 0.001;

const DYNAMIC_RANGE_WINDOW: usize = 2048;
const RMS_EPSILON: f64 = 1e-10;

const NOISE_FLOOR_WINDOW_SECS: f64 = 0.5;

pub fn detect_clipping(samples: &[f32]) -> bool {
  if samples.is_empty() {
    return false;
  }
  let clipped = samples
    .iter()
    .filter(|s| s.abs() >= CLIPPING_THRESHOLD)
    .count();
  (clipped as f64 / samples.len() as f64) > CLIPPING_RATIO
}

pub fn estimate_max_frequency(samples: &[f32], sample_rate: u32) -> f32 {
  if sample_rate == 0 || samples.len() < FFT_SIZE {
    return 0.0;
  }

  let mut planner = FftPlanner::<f32>::new();
  let fft = planner.plan_fft_forward(FFT_SIZE);

  let window: Vec<f32> = (0..FFT_SIZE)
    .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (FFT_SIZE - 1) as f32).cos())
    .collect();

  let num_bins = FFT_SIZE / 2;
  let mut energy = vec![0f64; num_bins];

  let mut pos = 0;
  while pos + FFT_SIZE <= samples.len() {
    let mut buffer: Vec<Complex<f32>> = samples[pos..pos + FFT_SIZE]
      .iter()
      .zip(window.iter())
      .map(|(s, w)| Complex::new(s * w, 0.0))
      .collect();

    fft.process(&mut buffer);

    for (bin, value) in buffer.iter().take(num_bins).enumerate() {
      energy[bin] += f64::from(value.norm_sqr());
    }

    pos += HOP_SIZE;
  }

  let max_energy = energy.iter().cloned().fold(0.0, f64::max);
  if max_energy <= 0.0 {
    return 0.0;
  }

  let threshold = max_energy * FREQUENCY_ENERGY_RATIO;
  let highest_bin = energy
    .iter()
    .enumerate()
    .rev()
    .find(|(_, e)| **e > threshold)
    .map_or(0, |(bin, _)| bin);

  highest_bin as f32 * sample_rate as f32 / FFT_SIZE as f32
}

pub fn estimate_dynamic_range_db(samples: &[f32]) -> f32 {
  if samples.is_empty() {
    return 0.0;
  }

  let window = DYNAMIC_RANGE_WINDOW.min(samples.len()).max(1);
  let mut rms_values: Vec<f64> = Vec::new();

  let mut pos = 0;
  while pos < samples.len() {
    let end = (pos + window).min(samples.len());
    let frame = &samples[pos..end];
    let sum_sq: f64 = frame.iter().map(|s| f64::from(*s) * f64::from(*s)).sum();
    let rms = (sum_sq / frame.len() as f64).sqrt();
    if rms > 0.0 {
      rms_values.push(rms);
    }
    pos += window;
  }

  if rms_values.is_empty() {
    return 0.0;
  }

  let max_rms = rms_values.iter().cloned().fold(0.0, f64::max);
  let min_rms = rms_values.iter().cloned().fold(f64::MAX, f64::min);

  (20.0 * (max_rms / (min_rms + RMS_EPSILON)).log10()) as f32
}

pub fn estimate_noise_floor_rms(samples: &[f32], sample_rate: u32) -> f32 {
  if samples.is_empty() || sample_rate == 0 {
    return 0.0;
  }

  let window = ((f64::from(sample_rate)) * NOISE_FLOOR_WINDOW_SECS) as usize;
  let window = window.min(samples.len()).max(1);
  let frame = &samples[..window];

  let sum_sq: f64 = frame.iter().map(|s| f64::from(*s) * f64::from(*s)).sum();
  ((sum_sq / frame.len() as f64).sqrt()) as f32
}

pub fn score_and_issues(
  clipping_detected: bool,
  max_frequency_hz: f32,
  dynamic_range_db: f32,
  noise_floor_rms: f32,
) -> (u8, Vec<String>) {
  let mut score: i32 = 100;
  let mut issues = Vec::new();

  if clipping_detected {
    score -= 40;
    issues.push("Clipping detected".to_string());
  }

  if max_frequency_hz < 16_000.0 {
    score -= 50;
    issues.push(format!(
      "Severe frequency cutoff at {max_frequency_hz:.0} Hz (likely heavily transcoded)"
    ));
  } else if max_frequency_hz < 19_000.0 {
    score -= 20;
    issues.push(format!(
      "Frequency cutoff at {max_frequency_hz:.0} Hz (possible lossy transcode)"
    ));
  }

  if dynamic_range_db < 6.0 {
    score -= 25;
    issues.push(format!("Very low dynamic range ({dynamic_range_db:.1} dB)"));
  } else if dynamic_range_db < 12.0 {
    score -= 10;
    issues.push(format!("Low dynamic range ({dynamic_range_db:.1} dB)"));
  }

  if noise_floor_rms > 0.01 {
    score -= 20;
    issues.push(format!("High noise floor ({noise_floor_rms:.4} RMS)"));
  }

  (score.clamp(0, 100) as u8, issues)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn sine_wave(freq: f32, sample_rate: u32, duration_secs: f32, amplitude: f32) -> Vec<f32> {
    let num_samples = (sample_rate as f32 * duration_secs) as usize;
    (0..num_samples)
      .map(|i| {
        amplitude * (2.0 * std::f32::consts::PI * freq * i as f32 / sample_rate as f32).sin()
      })
      .collect()
  }

  #[test]
  fn detects_clipping_in_heavily_clipped_signal() {
    let mut samples = sine_wave(440.0, 44_100, 0.5, 1.5);
    for s in &mut samples {
      *s = s.clamp(-1.0, 1.0);
    }
    assert!(detect_clipping(&samples));
  }

  #[test]
  fn does_not_detect_clipping_in_clean_signal() {
    let samples = sine_wave(440.0, 44_100, 0.5, 0.5);
    assert!(!detect_clipping(&samples));
  }

  #[test]
  fn empty_signal_has_no_clipping() {
    assert!(!detect_clipping(&[]));
  }

  #[test]
  fn estimates_max_frequency_near_signal_frequency() {
    let sample_rate = 44_100;
    let samples = sine_wave(5_000.0, sample_rate, 1.0, 0.8);
    let max_freq = estimate_max_frequency(&samples, sample_rate);
    assert!(
      (max_freq - 5_000.0).abs() < 200.0,
      "expected ~5000 Hz, got {max_freq}"
    );
  }

  #[test]
  fn detects_low_max_frequency_for_low_passed_signal() {
    let sample_rate = 44_100;
    let samples = sine_wave(2_000.0, sample_rate, 1.0, 0.8);
    let max_freq = estimate_max_frequency(&samples, sample_rate);
    assert!(max_freq < 16_000.0);
  }

  #[test]
  fn dynamic_range_is_low_for_constant_amplitude_signal() {
    let samples = sine_wave(440.0, 44_100, 1.0, 0.5);
    let dr = estimate_dynamic_range_db(&samples);
    assert!(dr < 6.0, "expected low dynamic range, got {dr}");
  }

  #[test]
  fn dynamic_range_is_higher_when_signal_has_quiet_and_loud_sections() {
    let mut samples = sine_wave(440.0, 44_100, 0.5, 0.01);
    samples.extend(sine_wave(440.0, 44_100, 0.5, 0.9));
    let dr = estimate_dynamic_range_db(&samples);
    assert!(dr > 12.0, "expected high dynamic range, got {dr}");
  }

  #[test]
  fn noise_floor_reflects_quiet_start_amplitude() {
    let samples = sine_wave(440.0, 44_100, 1.0, 0.02);
    let noise_floor = estimate_noise_floor_rms(&samples, 44_100);
    assert!(noise_floor > 0.0 && noise_floor < 0.02);
  }

  #[test]
  fn perfect_signal_scores_one_hundred_and_passes() {
    let (score, issues) = score_and_issues(false, 20_000.0, 20.0, 0.0001);
    assert_eq!(score, 100);
    assert!(issues.is_empty());
  }

  #[test]
  fn clipped_low_quality_signal_fails() {
    let (score, issues) = score_and_issues(true, 10_000.0, 4.0, 0.02);
    assert!(score < 60);
    assert_eq!(issues.len(), 4);
  }
}
