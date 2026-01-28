use crate::models::ytdlp::YtdlpFormat;
use crate::models::{MediaFormat, ParsedMedia, ParsedSingleVideo, YtdlpInfo};
use std::collections::HashSet;

pub fn parse_single(info: YtdlpInfo, id: String) -> ParsedMedia {
  let (video_codecs, audio_codecs, media_formats) = if let Some(formats) = &info.formats {
    process_formats(formats)
  } else {
    (HashSet::new(), HashSet::new(), Vec::new())
  };

  let detected = media_formats.len();
  let provided = info.formats.as_ref().map_or(0, Vec::len);
  let loss_pct = if provided == 0 {
    0.0
  } else {
    100.0 * (provided - detected).max(0) as f64 / provided as f64
  };

  tracing::debug!(
    "Detected unique formats: {} out of {} provided ({:.1}% filtered).",
    detected,
    provided,
    loss_pct,
  );

  ParsedMedia::Single(ParsedSingleVideo {
    id,
    url: info.webpage_url,
    title: info.title,
    thumbnail: info.thumbnail,
    uploader: info.uploader,
    uploader_id: info.uploader_id,
    duration: info.duration,
    views: i64_to_u64(info.view_count),
    likes: i64_to_u64(info.like_count),
    dislikes: i64_to_u64(info.dislike_count),
    rating: info.average_rating,
    description: info.description,
    extractor: info.extractor_key,
    comments: i64_to_u64(info.comment_count),
    filesize: i64_to_u64(info.filesize.or(info.filesize_approx)),
    video_codecs: video_codecs.into_iter().collect(),
    audio_codecs: audio_codecs.into_iter().collect(),
    formats: media_formats,
  })
}

fn process_formats(
  formats: &[YtdlpFormat],
) -> (HashSet<String>, HashSet<String>, Vec<MediaFormat>) {
  let mut video_codecs = HashSet::new();
  let mut audio_codecs = HashSet::new();
  let mut media_formats = Vec::new();
  let mut detected = HashSet::new();

  for fmt in formats {
    if fmt.height.is_some() {
      if let Some(vc) = &fmt.vcodec {
        if vc != "none" {
          video_codecs.insert(vc.clone());
        }
      }
    } else if let Some(ac) = &fmt.acodec {
      if ac != "none" {
        audio_codecs.insert(ac.clone());
      }
    }
  }

  for fmt in formats {
    if fmt.ext.as_deref() == Some("mhtml") {
      continue;
    }

    let mut abr_norm = fmt.abr;
    if matches!(abr_norm, Some(a) if a == 0.0) {
      abr_norm = None;
    }

    let mut fps_norm = fmt.fps;
    if matches!(fps_norm, Some(f) if f == 0.0) {
      fps_norm = None;
    }

    let (format_id, height, abr, fps) = match (&fmt.format_id, fmt.height, abr_norm, fps_norm) {
      (Some(format_id), Some(height), None, fps) => {
        let fps_rounded = fps.map(|f| f.round() as u64);
        (format_id.clone(), Some(height), None, fps_rounded)
      }
      (Some(format_id), None, Some(abr), None) => {
        let abr_rounded = abr.round() as u64;
        (format_id.clone(), None, Some(abr_rounded), None)
      }
      _ => continue,
    };

    let key = if let Some(h) = height {
      let fps_key = fps.map_or_else(|| "none".into(), |f| f.to_string());
      format!("{h}x{fps_key}")
    } else {
      abr.map_or_else(|| "none".into(), |a| a.to_string())
    };

    tracing::debug!("Detected format: {:?}", (format_id.clone(), key.clone()));
    if detected.contains(&key) {
      continue;
    }

    let codecs = collect_codecs_for_group(formats, height, fps, abr);

    media_formats.push(MediaFormat {
      id: format_id.clone(),
      abr,
      height: i64_to_u64(height),
      fps,
      codecs: codecs.into_iter().collect(),
    });

    detected.insert(key);
  }

  (video_codecs, audio_codecs, media_formats)
}

#[allow(clippy::cast_possible_truncation)]
fn collect_codecs_for_group(
  formats: &[YtdlpFormat],
  height: Option<i64>,
  fps: Option<u64>,
  abr: Option<u64>,
) -> HashSet<String> {
  let mut codecs = HashSet::new();

  for other in formats {
    let is_match = if let Some(h) = height {
      other.height == Some(h)
        && ((fps.is_none() && other.fps.is_none()) || other.fps.map(|f| f.round() as u64) == fps)
    } else if let Some(a) = abr {
      other.abr.map(|x| x.round() as u64) == Some(a)
    } else {
      false
    };

    if !is_match {
      continue;
    }

    if let Some(vc) = &other.vcodec {
      if vc != "none" {
        codecs.insert(vc.clone());
      }
    }
    if let Some(ac) = &other.acodec {
      if ac != "none" {
        codecs.insert(ac.clone());
      }
    }
  }

  codecs
}

pub fn i64_to_u64(v: Option<i64>) -> Option<u64> {
  v.and_then(|x| u64::try_from(x).ok())
}
