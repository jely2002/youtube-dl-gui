use std::fmt;
use std::fs::File;
use std::path::Path;

use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::codecs::CodecParameters;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::{MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::meta::MetadataOptions;

pub struct DecodedAudio {
  pub samples: Vec<f32>,
  pub sample_rate: u32,
}

#[derive(Debug)]
pub enum DecodeError {
  Io(std::io::Error),
  UnsupportedFormat,
  NoAudioTrack,
  DecodeFailed(String),
}

impl fmt::Display for DecodeError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::Io(e) => write!(f, "Failed to read audio file: {e}"),
      Self::UnsupportedFormat => write!(f, "Unsupported or undecodable audio format"),
      Self::NoAudioTrack => write!(f, "No audio track found in file"),
      Self::DecodeFailed(e) => write!(f, "Failed to decode audio: {e}"),
    }
  }
}

impl std::error::Error for DecodeError {}

impl From<std::io::Error> for DecodeError {
  fn from(e: std::io::Error) -> Self {
    Self::Io(e)
  }
}

pub fn decode_to_mono_samples(path: &Path) -> Result<DecodedAudio, DecodeError> {
  let file = File::open(path)?;

  let mut hint = Hint::new();
  if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
    hint.with_extension(ext);
  }

  let mss = MediaSourceStream::new(Box::new(file), MediaSourceStreamOptions::default());

  let mut format = symphonia::default::get_probe()
    .probe(
      &hint,
      mss,
      FormatOptions::default(),
      MetadataOptions::default(),
    )
    .map_err(|_| DecodeError::UnsupportedFormat)?;

  let track = format
    .default_track(TrackType::Audio)
    .ok_or(DecodeError::NoAudioTrack)?;
  let track_id = track.id;

  let audio_params = match track.codec_params.clone() {
    Some(CodecParameters::Audio(params)) => params,
    _ => return Err(DecodeError::NoAudioTrack),
  };

  let mut decoder = symphonia::default::get_codecs()
    .make_audio_decoder(&audio_params, &AudioDecoderOptions::default())
    .map_err(|_| DecodeError::UnsupportedFormat)?;

  let mut sample_rate = audio_params.sample_rate.unwrap_or(0);
  let mut mono_samples: Vec<f32> = Vec::new();
  let mut interleaved: Vec<f32> = Vec::new();

  loop {
    let packet = match format.next_packet() {
      Ok(Some(packet)) => packet,
      Ok(None) => break,
      Err(SymphoniaError::IoError(ref io_err))
        if io_err.kind() == std::io::ErrorKind::UnexpectedEof =>
      {
        break;
      }
      Err(e) => return Err(DecodeError::DecodeFailed(e.to_string())),
    };

    if packet.track_id != track_id {
      continue;
    }

    let decoded = match decoder.decode(&packet) {
      Ok(decoded) => decoded,
      Err(SymphoniaError::DecodeError(_)) => continue,
      Err(e) => return Err(DecodeError::DecodeFailed(e.to_string())),
    };

    let spec = decoded.spec().clone();
    if sample_rate == 0 {
      sample_rate = spec.rate();
    }
    let channels = spec.channels().count().max(1);

    interleaved.clear();
    decoded.copy_to_vec_interleaved(&mut interleaved);

    mono_samples.reserve(interleaved.len() / channels);
    for frame in interleaved.chunks_exact(channels) {
      let sum: f32 = frame.iter().sum();
      mono_samples.push(sum / channels as f32);
    }
  }

  if mono_samples.is_empty() || sample_rate == 0 {
    return Err(DecodeError::DecodeFailed(
      "no decodable audio samples found".to_string(),
    ));
  }

  Ok(DecodedAudio {
    samples: mono_samples,
    sample_rate,
  })
}
