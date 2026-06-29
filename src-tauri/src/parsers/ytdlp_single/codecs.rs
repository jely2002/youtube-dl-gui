use crate::models::MediaCodec;
use std::collections::HashMap;

pub(super) fn insert_codec(target: &mut HashMap<String, MediaCodec>, codec: &str) {
  let id = codec.trim();
  if id.is_empty() {
    return;
  }

  let key = id.to_lowercase();
  target.entry(key).or_insert_with(|| parse_codec_label(id));
}

pub(super) fn sort_codecs(mut codecs: Vec<MediaCodec>) -> Vec<MediaCodec> {
  codecs.sort_by(|a, b| a.label.cmp(&b.label).then_with(|| a.id.cmp(&b.id)));
  codecs
}

fn parse_codec_label(codec: &str) -> MediaCodec {
  let raw = codec.trim();
  if raw.is_empty() {
    return MediaCodec {
      id: raw.to_string(),
      label: raw.to_string(),
    };
  }

  let lower = raw.to_lowercase();

  if lower.starts_with("av01.") {
    if let Some(label) = parse_av1_codec_label(raw) {
      return MediaCodec {
        id: raw.to_string(),
        label,
      };
    }
  }

  if lower.starts_with("avc1.") {
    if let Some(label) = parse_avc1_codec_label(raw) {
      return MediaCodec {
        id: raw.to_string(),
        label,
      };
    }
  }

  if lower.starts_with("mp4a.") {
    if let Some(label) = parse_mp4a_codec_label(raw) {
      return MediaCodec {
        id: raw.to_string(),
        label,
      };
    }
  }

  let label = match lower.as_str() {
    "aac" => "AAC".to_string(),
    "mp4a" => "AAC".to_string(),
    "flac" => "FLAC".to_string(),
    "mp3" => "MP3".to_string(),
    "opus" => "Opus".to_string(),
    "vorbis" => "Vorbis".to_string(),
    "vp9" | "vp09" => "VP9".to_string(),
    _ => raw.to_string(),
  };

  MediaCodec {
    id: raw.to_string(),
    label,
  }
}

fn parse_av1_codec_label(codec: &str) -> Option<String> {
  let mut parts = codec.trim().split('.');
  let family = parts.next()?;
  if family.to_lowercase() != "av01" {
    return None;
  }
  let profile = parts.next()?;
  let level_tier = parts.next()?;
  let bit_depth = parts.next()?;

  if parts.next().is_some() {
    return None;
  }

  if level_tier.len() < 3 {
    return None;
  }
  let level = &level_tier[0..2];

  let parsed_level = parse_av1_level(level)?;
  let profile = match profile {
    "0" => "Main",
    other => {
      return Some(format!(
        "AV1 Profile {other}, Level {parsed_level}, {bit_depth}-bit"
      ))
    }
  };

  Some(format!(
    "AV1 {profile}, Level {parsed_level}, {bit_depth}-bit"
  ))
}

fn parse_av1_level(level: &str) -> Option<String> {
  let value: u32 = level.parse().ok()?;
  Some(format!("{:.1}", value as f64 / 4.0))
}

fn parse_avc1_codec_label(codec: &str) -> Option<String> {
  let lower = codec.trim().to_lowercase();
  let rest = lower.strip_prefix("avc1.")?;
  if rest.len() != 6 {
    return None;
  }

  let profile_hex = &rest[0..2];
  let level_hex = &rest[4..6];
  let profile = match profile_hex {
    "42" => "Baseline",
    "4d" => "Main",
    "58" => "Extended",
    "64" => "High",
    _ => return None,
  };

  let level = u32::from_str_radix(level_hex, 16).ok()?;
  Some(format!("H.264 {profile}, Level {:.1}", level as f64 / 10.0))
}

fn parse_mp4a_codec_label(codec: &str) -> Option<String> {
  let mut parts = codec.trim().split('.');
  let family = parts.next()?;
  if family.to_lowercase() != "mp4a" {
    return None;
  }

  let oti = parts.next()?;
  let aot = parts.next();
  if parts.next().is_some() {
    return None;
  }

  let Some(aot) = aot else {
    return Some(match oti {
      "40" => "MPEG-4 Audio".to_string(),
      _ => format!("MPEG-4 Audio (mp4a.{oti})"),
    });
  };

  let aot_num: u32 = aot.parse().ok()?;
  let label = match aot_num {
    1 => "AAC Main",
    2 => "AAC LC",
    3 => "AAC SSR",
    4 => "AAC LTP",
    5 => "HE-AAC v1",
    6 => "AAC Scalable",
    17 => "ER AAC LC",
    19 => "ER AAC LTP",
    20 => "ER AAC Scalable",
    23 => "ER AAC ELD",
    29 => "HE-AAC v2",
    _ => return Some(format!("MPEG-4 Audio (mp4a.{oti}.{aot_num})")),
  };

  if oti == "40" {
    Some(label.to_string())
  } else {
    Some(format!("{label} (mp4a.{oti}.{aot_num})"))
  }
}

#[cfg(test)]
mod tests {
  use super::parse_codec_label;

  #[test]
  fn labels_known_video_codecs() {
    let avc1 = parse_codec_label("avc1.640028");
    let av1 = parse_codec_label("av01.0.08M.10");

    assert_eq!(avc1.id, "avc1.640028");
    assert_eq!(avc1.label, "H.264 High, Level 4.0");
    assert_eq!(av1.id, "av01.0.08M.10");
    assert_eq!(av1.label, "AV1 Main, Level 2.0, 10-bit");
  }

  #[test]
  fn labels_mp4a_variants_distinctly() {
    let aac = parse_codec_label("aac");
    let aac_lc = parse_codec_label("mp4a.40.2");
    let he_aac = parse_codec_label("mp4a.20.5");

    assert_eq!(aac.label, "AAC");
    assert_eq!(aac_lc.label, "AAC LC");
    assert_eq!(he_aac.label, "HE-AAC v1 (mp4a.20.5)");
  }
}
