mod chapters;
mod codecs;
mod common;
mod formats;
mod tracks;

#[cfg(test)]
mod test_support;

#[cfg(test)]
mod tests;

use crate::models::{ParsedMedia, ParsedSingleVideo, YtdlpInfo};
use chapters::process_chapters;
use formats::{process_formats, ProcessedFormats};
use tracks::auto_track;

pub(crate) use common::i64_to_u64;

pub fn parse_single(info: YtdlpInfo, id: String) -> ParsedMedia {
  let ProcessedFormats {
    video_codecs,
    audio_codecs,
    media_formats,
    audio_tracks,
    video_tracks,
  } = if let Some(formats) = &info.formats {
    process_formats(formats)
  } else {
    ProcessedFormats {
      video_codecs: Vec::new(),
      audio_codecs: Vec::new(),
      media_formats: Vec::new(),
      audio_tracks: vec![auto_track()],
      video_tracks: vec![auto_track()],
    }
  };

  let detected = media_formats.len();
  let provided = info.formats.as_ref().map_or(0, Vec::len);
  let loss_pct = if provided == 0 {
    0.0
  } else {
    100.0 * (provided - detected) as f64 / provided as f64
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
    video_codecs,
    audio_codecs,
    video_tracks,
    audio_tracks,
    formats: media_formats,
    chapters: process_chapters(info.chapters.as_deref()),
  })
}
