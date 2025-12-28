use crate::models::progress::MediaDestinationPath;
use crate::models::{
  MediaDestination, MediaProgress, MediaProgressStage, ProgressCategory, ProgressEvent,
  ProgressStage,
};
use std::path::Path;

pub struct YtdlpProgressParser {
  id: String,
  group_id: String,
  current_category: ProgressCategory,
  current_stage: ProgressStage,
}

impl YtdlpProgressParser {
  pub fn new(id: &str, group_id: &str) -> Self {
    Self {
      id: id.to_string(),
      group_id: group_id.to_string(),
      current_category: ProgressCategory::Other,
      current_stage: ProgressStage::Initializing,
    }
  }

  pub fn parse_line(&mut self, line: &str) -> Vec<ProgressEvent> {
    let mut evts = Vec::new();

    if let Some(evt) = self.try_destination(line) {
      evts.push(evt);
    }

    if let Some(evt) = self.try_download_stage(line) {
      evts.push(evt);
      return evts;
    }

    if let Some(evt) = self.try_progress_update(line) {
      evts.push(evt);
      return evts;
    }

    if let Some(evt) = self.try_merger_destination(line) {
      evts.push(evt);
    }

    if let Some(evt) = self.try_merging_stage(line) {
      evts.push(evt);
      return evts;
    }

    if let Some(evt) = self.try_finalizing_stage(line) {
      evts.push(evt);
      return evts;
    }

    evts
  }

  fn try_merger_destination(&self, line: &str) -> Option<ProgressEvent> {
    const PREFIX: &str = "[Merger] Merging formats into";
    if let Some(rest) = line.strip_prefix(PREFIX) {
      let destination = rest.trim().trim_matches('"').to_string();

      return Some(ProgressEvent::Destination(MediaDestination {
        id: self.id.clone(),
        group_id: self.group_id.clone(),
        is_merged: true,
        destination: MediaDestinationPath {
          confidence: 80,
          path: destination,
        },
      }));
    }
    None
  }

  fn try_destination(&self, line: &str) -> Option<ProgressEvent> {
    let (_, rest) = line.split_once("Destination:")?;
    let full_path = rest.trim().to_string();

    let tag = line
      .split(']')
      .next()
      .map(|s| s.trim_start_matches('['))
      .unwrap_or("unknown");

    let confidence = match tag {
      "VideoConvertor" => 95,
      "VideoRemuxer" => 90,
      "Merger" | "ExtractAudio" => 70,
      "download" => 60,
      _ => 50,
    };

    Some(ProgressEvent::Destination(MediaDestination {
      id: self.id.clone(),
      group_id: self.group_id.clone(),
      destination: MediaDestinationPath {
        confidence,
        path: full_path,
      },
      is_merged: false,
    }))
  }

  fn try_download_stage(&mut self, line: &str) -> Option<ProgressEvent> {
    if line.contains("[download] Destination:") {
      if let Some(path) = line.trim().split("Destination:").nth(1) {
        let ext = Path::new(path)
          .extension()
          .and_then(|e| e.to_str())
          .unwrap_or("")
          .to_ascii_lowercase();

        self.current_category = match ext.as_str() {
          "mp4" | "mkv" | "webm" | "flv" | "mov" | "avi" | "m4v" | "ts" | "m2ts" | "3gp" => {
            ProgressCategory::Video
          }
          "mp3" | "m4a" | "wav" | "flac" | "ogg" | "opus" | "mka" | "aiff" | "wma" | "alac"
          | "aac" => ProgressCategory::Audio,
          "vtt" | "srt" | "ass" | "lrc" | "ttml" | "srv1" | "srv2" | "srv3" => {
            ProgressCategory::Subtitles
          }
          "jpg" | "jpeg" | "png" | "webp" | "bmp" => ProgressCategory::Thumbnail,
          "json" => ProgressCategory::Metadata,
          _ => ProgressCategory::Other,
        };
      }
      if self.current_stage != ProgressStage::Downloading {
        self.current_stage = ProgressStage::Downloading;
        return Some(ProgressEvent::StageChange(MediaProgressStage {
          id: self.id.clone(),
          group_id: self.group_id.clone(),
          stage: self.current_stage.clone(),
        }));
      }
    }
    None
  }

  pub fn try_progress_update(&self, line: &str) -> Option<ProgressEvent> {
    fn parse_opt_u64(s: &str) -> Option<u64> {
      let t = s.trim();
      if t.is_empty() || t.eq_ignore_ascii_case("na") {
        None
      } else {
        t.parse().ok()
      }
    }
    fn parse_opt_f64(s: &str) -> Option<f64> {
      let t = s.trim();
      if t.is_empty() || t.eq_ignore_ascii_case("na") {
        None
      } else {
        t.parse().ok()
      }
    }
    fn parse_opt_pct(s: &str) -> Option<f64> {
      let t = s.trim().trim_end_matches('%').trim();
      if t.is_empty() || t.eq_ignore_ascii_case("na") {
        None
      } else {
        t.parse::<f64>().ok()
      }
    }

    fn get_or_empty<'a>(parts: &[&'a str], i: usize) -> &'a str {
      if i < parts.len() {
        parts[i]
      } else {
        ""
      }
    }

    const fn clamp01pct(p: f64) -> f64 {
      if p.is_finite() {
        p.clamp(0.0, 100.0)
      } else {
        0.0
      }
    }

    let line = line.trim_end();
    let raw = line.strip_prefix("RAW|")?;

    // Expect 9 fields from a progress line, fewer is okay.
    let mut parts: Vec<&str> = raw.split('|').collect();
    while parts.len() < 9 {
      parts.push("");
    }

    let pct_num = parse_opt_pct(get_or_empty(&parts, 0)); // progress.percent
    let pct_str = parse_opt_pct(get_or_empty(&parts, 1)); // progress._percent_str
    let speed_bps = parse_opt_f64(get_or_empty(&parts, 2)); // progress.speed (bytes/sec)
    let eta_secs = parse_opt_u64(get_or_empty(&parts, 3)); // progress.eta (seconds)
    let dl = parse_opt_u64(get_or_empty(&parts, 4)); // downloaded_bytes
    let total = parse_opt_u64(get_or_empty(&parts, 5)); // total_bytes
    let estimate = parse_opt_u64(get_or_empty(&parts, 6)); // total_bytes_estimate
    let frag_i = parse_opt_u64(get_or_empty(&parts, 7)); // fragment_index
    let frag_n = parse_opt_u64(get_or_empty(&parts, 8)); // fragment_count

    let percentage = pct_num
      .or(pct_str)
      .or_else(|| {
        let t = total.or(estimate)?;
        let d = dl?;
        if t == 0 {
          None
        } else {
          Some((d as f64 / t as f64) * 100.0)
        }
      })
      .or_else(|| {
        let (i, n) = (frag_i?, frag_n?);
        if n == 0 {
          None
        } else {
          Some((i as f64 / n as f64) * 100.0)
        }
      })
      .map(clamp01pct);

    // If no data is retrieved, drop the line.
    if percentage.is_none() && speed_bps.is_none() && eta_secs.is_none() {
      return None;
    }

    Some(ProgressEvent::Progress(MediaProgress {
      id: self.id.clone(),
      group_id: self.group_id.clone(),
      category: self.current_category.clone(),
      percentage,
      speed_bps,
      eta_secs,
    }))
  }

  fn try_merging_stage(&mut self, line: &str) -> Option<ProgressEvent> {
    if line.starts_with("[Merger]") && self.current_stage != ProgressStage::Merging {
      self.current_stage = ProgressStage::Merging;
      return Some(ProgressEvent::StageChange(MediaProgressStage {
        id: self.id.clone(),
        group_id: self.group_id.clone(),
        stage: self.current_stage.clone(),
      }));
    }
    None
  }

  fn try_finalizing_stage(&mut self, line: &str) -> Option<ProgressEvent> {
    let triggers = ["[ffmpeg]", "[Fixup]", "Deleting original file"];
    if triggers
      .iter()
      .any(|p| line.starts_with(p) || line.contains(p))
      && self.current_stage != ProgressStage::Finalizing
    {
      self.current_stage = ProgressStage::Finalizing;
      return Some(ProgressEvent::StageChange(MediaProgressStage {
        id: self.id.clone(),
        group_id: self.group_id.clone(),
        stage: self.current_stage.clone(),
      }));
    }
    None
  }
}
