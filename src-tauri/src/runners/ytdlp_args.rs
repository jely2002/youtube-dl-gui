use crate::config::OutputSettings;
use crate::models::download::{AudioFormat, FormatOptions, TranscodePolicy, VideoContainer};
use crate::models::TrackType;

pub fn build_format_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
) -> Vec<String> {
  let mut args = Vec::new();

  match format_options.track_type {
    TrackType::Audio => {
      args.push("-x".into());

      args.push("-f".into());
      args.push("ba/best".into());

      let mut sort_fields = Vec::new();
      sort_fields.push("lang".into());

      if let Some(asr) = format_options.asr {
        sort_fields.push(format!("asr~{asr}"));
      } else {
        sort_fields.push("asr".into());
      }

      match output_settings.audio.format {
        AudioFormat::M4a | AudioFormat::Aac => {
          sort_fields.push("aext:m4a".into());
          sort_fields.push("acodec:aac".into());
        }
        AudioFormat::Opus => {
          sort_fields.push("acodec:opus".into());
          sort_fields.push("aext:webm".into());
        }
        AudioFormat::Ogg => {
          sort_fields.push("aext:ogg".into());
          sort_fields.push("acodec:vorbis".into());
        }
        AudioFormat::Flac | AudioFormat::Wav => {
          sort_fields.push("acodec:opus".into());
        }
        AudioFormat::Mp3 => {
          sort_fields.push("aext:mp3".into());
        }
      }

      let sort_arg = sort_fields.join(",");

      args.push("-S".into());
      args.push(sort_arg);
    }

    TrackType::Video | TrackType::Both => {
      let selector = match format_options.track_type {
        TrackType::Video => "bv".to_string(),
        TrackType::Both => "bv*+ba/bv+ba/best".to_string(),
        TrackType::Audio => unreachable!(),
      };
      args.push("-f".into());
      args.push(selector);

      let mut sort_fields = Vec::new();
      sort_fields.push("lang".into());

      if let Some(h) = format_options.height {
        sort_fields.push(format!("res:{h}"));
      } else {
        sort_fields.push("res".into());
      }
      if let Some(f) = format_options.fps {
        sort_fields.push(format!("fps:{f}"));
      } else {
        sort_fields.push("fps".into());
      }

      if matches!(output_settings.video.container, VideoContainer::Mp4) {
        sort_fields.push("vext:mp4".into());
        sort_fields.push("vext:m4a".into());
      } else {
        sort_fields.push("vext".into());
      }

      let sort_arg = sort_fields.join(",");

      args.push("-S".into());
      args.push(sort_arg);
    }
  }

  args
}

pub fn build_output_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
) -> Vec<String> {
  let mut args = Vec::new();

  match format_options.track_type {
    TrackType::Audio => match output_settings.audio.policy {
      TranscodePolicy::Never => {
        if output_settings.add_thumbnail
          && matches!(
            output_settings.audio.format,
            AudioFormat::Mp3 | AudioFormat::M4a
          )
        {
          args.push("--embed-thumbnail".into());
        }
      }
      TranscodePolicy::RemuxOnly | TranscodePolicy::AllowReencode => {
        args.push("--audio-format".into());
        let fmt = match output_settings.audio.format {
          AudioFormat::Mp3 => "mp3",
          AudioFormat::M4a => "m4a",
          AudioFormat::Opus => "opus",
          AudioFormat::Aac => "aac",
          AudioFormat::Ogg => "ogg",
          AudioFormat::Flac => "flac",
          AudioFormat::Wav => "wav",
        };
        args.push(fmt.into());

        if output_settings.add_thumbnail
          && output_settings.audio.format.supports_embedded_thumbnail()
        {
          args.push("--embed-thumbnail".into());
        }
      }
    },

    TrackType::Video | TrackType::Both => match output_settings.video.policy {
      TranscodePolicy::Never => {
        if output_settings.add_thumbnail {
          args.push("--embed-thumbnail".into());
        }
      }
      TranscodePolicy::RemuxOnly => {
        args.push("--remux-video".into());
        let container = match output_settings.video.container {
          VideoContainer::Mp4 => "mp4",
          VideoContainer::Mkv => "mkv",
        };
        args.push(container.into());

        if output_settings.add_thumbnail {
          args.push("--embed-thumbnail".into());
        }
      }
      TranscodePolicy::AllowReencode => {
        args.push("--recode-video".into());
        let container = match output_settings.video.container {
          VideoContainer::Mp4 => "mp4",
          VideoContainer::Mkv => "mkv",
        };
        args.push(container.into());

        if output_settings.add_thumbnail {
          args.push("--embed-thumbnail".into());
        }
      }
    },
  }

  if output_settings.add_metadata {
    args.push("--add-metadata".into());
  }

  if output_settings.restrict_filenames {
    args.push("--restrict-filenames".into());
  }

  args
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::models::download::{AudioFormat, FormatOptions, TranscodePolicy, VideoContainer};
  use crate::models::TrackType;

  fn make_audio_format_options(asr: Option<u32>) -> FormatOptions {
    FormatOptions {
      track_type: TrackType::Audio,
      asr,
      height: None,
      fps: None,
    }
  }

  fn make_video_format_options(height: Option<u32>, fps: Option<u32>) -> FormatOptions {
    FormatOptions {
      track_type: TrackType::Video,
      asr: None,
      height,
      fps,
    }
  }

  fn make_both_format_options(height: Option<u32>, fps: Option<u32>) -> FormatOptions {
    FormatOptions {
      track_type: TrackType::Both,
      asr: None,
      height,
      fps,
    }
  }

  #[test]
  fn audio_format_args_without_asr() {
    let format_options = make_audio_format_options(None);
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);

    let expected: Vec<String> = vec!["-x", "-f", "ba/best", "-S", "lang,asr,aext:mp3"]
      .into_iter()
      .map(String::from)
      .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn audio_format_args_with_asr() {
    let format_options = make_audio_format_options(Some(44));
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);

    let expected: Vec<String> = vec!["-x", "-f", "ba/best", "-S", "lang,asr~44,aext:mp3"]
      .into_iter()
      .map(String::from)
      .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn video_format_args_with_height_fps_and_mp4_bias() {
    let format_options = make_video_format_options(Some(720), Some(60));
    let settings = OutputSettings::default(); // default: video.container = Mp4

    let args = build_format_args(&format_options, &settings);

    let expected: Vec<String> = vec!["-f", "bv", "-S", "lang,res:720,fps:60,vext:mp4,vext:m4a"]
      .into_iter()
      .map(String::from)
      .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn video_format_args_with_height_fps_and_mkv_no_mp4_bias() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.container = VideoContainer::Mkv;

    let args = build_format_args(&format_options, &settings);

    let expected: Vec<String> = vec!["-f", "bv", "-S", "lang,res:720,fps:60,vext"]
      .into_iter()
      .map(String::from)
      .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn both_format_args_uses_both_selector_and_mp4_bias() {
    let format_options = make_both_format_options(Some(1080), Some(30));
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);

    let expected: Vec<String> = vec![
      "-f",
      "bv*+ba/bv+ba/best",
      "-S",
      "lang,res:1080,fps:30,vext:mp4,vext:m4a",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn audio_output_args_never_policy_produces_no_flags() {
    let format_options = make_audio_format_options(None);

    let mut settings = OutputSettings::default();
    settings.audio.policy = TranscodePolicy::Never;
    settings.audio.format = AudioFormat::Mp3;

    let args = build_output_args(&format_options, &settings);

    let expected: Vec<String> = vec!["--embed-thumbnail", "--add-metadata"]
      .into_iter()
      .map(String::from)
      .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn audio_output_args_allow_reencode_mp3() {
    let format_options = make_audio_format_options(None);

    let mut settings = OutputSettings::default();
    settings.audio.policy = TranscodePolicy::AllowReencode;
    settings.audio.format = AudioFormat::Mp3;

    let args = build_output_args(&format_options, &settings);

    let expected: Vec<String> = vec![
      "--audio-format",
      "mp3",
      "--embed-thumbnail",
      "--add-metadata",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn audio_output_args_allow_reencode_ogg() {
    let format_options = make_audio_format_options(None);

    let mut settings = OutputSettings::default();
    settings.audio.policy = TranscodePolicy::AllowReencode;
    settings.audio.format = AudioFormat::Ogg;

    let args = build_output_args(&format_options, &settings);

    let expected: Vec<String> = vec![
      "--audio-format",
      "ogg",
      "--embed-thumbnail",
      "--add-metadata",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn video_output_args_never_policy_produces_no_flags() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.container = VideoContainer::Mp4;

    let args = build_output_args(&format_options, &settings);

    let expected: Vec<String> = vec!["--embed-thumbnail", "--add-metadata"]
      .into_iter()
      .map(String::from)
      .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn video_output_args_remux_mp4() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::RemuxOnly;
    settings.video.container = VideoContainer::Mp4;

    let args = build_output_args(&format_options, &settings);

    let expected: Vec<String> = vec![
      "--remux-video",
      "mp4",
      "--embed-thumbnail",
      "--add-metadata",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn video_output_args_recode_mkv() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::AllowReencode;
    settings.video.container = VideoContainer::Mkv;

    let args = build_output_args(&format_options, &settings);

    let expected: Vec<String> = vec![
      "--recode-video",
      "mkv",
      "--embed-thumbnail",
      "--add-metadata",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn both_track_type_uses_video_policy_for_output() {
    let format_options = make_both_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::RemuxOnly;
    settings.video.container = VideoContainer::Mp4;

    let args = build_output_args(&format_options, &settings);

    let expected: Vec<String> = vec![
      "--remux-video",
      "mp4",
      "--embed-thumbnail",
      "--add-metadata",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn restrict_filenames_adds_flag_on_enable() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.restrict_filenames = true;

    let args = build_output_args(&format_options, &settings);

    assert!(args.contains(&"--restrict-filenames".to_string()));
  }

  #[test]
  fn restrict_filenames_omits_flag_on_disable() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.restrict_filenames = false;

    let args = build_output_args(&format_options, &settings);

    assert!(!args.contains(&"--restrict-filenames".to_string()));
  }
}
