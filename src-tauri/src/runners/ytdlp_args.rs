use crate::models::download::{
  AudioFormat, DownloadSection, FormatOptions, PartialDownloadOverride, TranscodePolicy,
  VideoContainer,
};
use crate::models::TrackType;
use crate::runners::template_context::TemplateContext;
use crate::state::config_models::OutputSettings;
use crate::state::preferences_models::PathPreferences;
use std::path::PathBuf;

pub fn build_format_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
) -> Vec<String> {
  let mut args = Vec::new();
  let audio_track_pref = parse_track_preference(format_options.audio_track.as_ref());
  let video_track_pref = parse_track_preference(format_options.video_track.as_ref());

  match format_options.track_type {
    TrackType::Audio => {
      args.push("-x".into());

      args.push("-f".into());
      if let Some(language) = audio_track_pref.language.as_ref() {
        let candidates = language_candidates(language);
        let mut selectors: Vec<String> = candidates
          .iter()
          .map(|lang| format!("ba[language={lang}]"))
          .collect();
        selectors.extend(["ba".into(), "best".into()]);
        args.push(selectors.join("/"));
      } else {
        args.push("ba/best".into());
      }

      let mut sort_fields = Vec::new();
      if let Some(language) = audio_track_pref.language {
        sort_fields.push(format!("lang:{language}"));
      } else {
        sort_fields.push("lang".into());
      }
      if let Some(channels) = audio_track_pref.channels {
        sort_fields.push(format!("channels:{channels}"));
      }

      if let Some(abr) = format_options.abr {
        sort_fields.push(format!("abr~{abr}"));
      }

      if let Some(audio_encoding) = format_options
        .audio_encoding
        .as_ref()
        .filter(|value| !value.trim().is_empty())
      {
        sort_fields.push(format!("acodec:{audio_encoding}"));
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
      let preferred_language = video_track_pref
        .language
        .as_ref()
        .or(audio_track_pref.language.as_ref());
      let selector = match &format_options.track_type {
        TrackType::Video => {
          if let Some(language) = video_track_pref.language.as_ref() {
            let candidates = language_candidates(language);
            let mut selectors: Vec<String> = candidates
              .iter()
              .flat_map(|lang| {
                [
                  format!("bv*[language={lang}]"),
                  format!("b[language={lang}]"),
                ]
              })
              .collect();
            selectors.extend(["bv".into(), "b".into()]);
            selectors.join("/")
          } else {
            "bv".to_string()
          }
        }
        TrackType::Both => {
          if let Some(language) = audio_track_pref.language.as_ref() {
            let candidates = language_candidates(language);
            // For combined downloads, multilingual audio is often only available on
            // progressive/HLS combined streams, so prioritize b[language=..] first.
            let mut selectors: Vec<String> = candidates
              .iter()
              .flat_map(|lang| {
                [
                  format!("b[language={lang}]"),
                  format!("bv*+ba[language={lang}]"),
                  format!("bv+ba[language={lang}]"),
                ]
              })
              .collect();
            selectors.extend(["bv*+ba".into(), "b".into()]);
            selectors.join("/")
          } else if let Some(language) = preferred_language {
            // Fallback if only video language is present.
            let candidates = language_candidates(language);
            let mut selectors: Vec<String> = candidates
              .iter()
              .flat_map(|lang| {
                [
                  format!("bv*[language={lang}]+ba"),
                  format!("b[language={lang}]"),
                ]
              })
              .collect();
            selectors.extend(["bv*+ba".into(), "b".into()]);
            selectors.join("/")
          } else {
            "bv*+ba/b".to_string()
          }
        }
        TrackType::Audio => unreachable!(),
      };
      args.push("-f".into());
      args.push(selector);

      let mut sort_fields = Vec::new();
      if let Some(language) = video_track_pref.language.or(audio_track_pref.language) {
        sort_fields.push(format!("lang:{language}"));
      } else {
        sort_fields.push("lang".into());
      }

      if let Some(h) = format_options.height {
        sort_fields.push(format!("res:{h}"));
      }
      if let Some(f) = format_options.fps {
        sort_fields.push(format!("fps:{f}"));
      }
      if let Some(video_encoding) = format_options
        .video_encoding
        .as_ref()
        .filter(|value| !value.trim().is_empty())
      {
        sort_fields.push(format!("vcodec:{video_encoding}"));
      }
      if matches!(format_options.track_type, TrackType::Both) {
        if let Some(audio_encoding) = format_options
          .audio_encoding
          .as_ref()
          .filter(|value| !value.trim().is_empty())
        {
          sort_fields.push(format!("acodec:{audio_encoding}"));
        }
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

#[derive(Debug, Default)]
struct TrackPreference {
  language: Option<String>,
  channels: Option<u32>,
}

fn parse_track_preference(track: Option<&String>) -> TrackPreference {
  let Some(raw) = track else {
    return TrackPreference::default();
  };

  if raw.trim().is_empty() || raw == "auto" {
    return TrackPreference::default();
  }

  let mut pref = TrackPreference::default();
  for part in raw.split('|') {
    if let Some(lang) = part.strip_prefix("lang:") {
      if !lang.trim().is_empty() {
        pref.language = Some(lang.trim().to_string());
      }
    } else if let Some(ch) = part.strip_prefix("channels:") {
      if let Ok(value) = ch.trim().parse::<u32>() {
        pref.channels = Some(value);
      }
    }
  }
  pref
}

fn language_candidates(language: &str) -> Vec<String> {
  let lang = language.trim();
  if lang.is_empty() {
    return Vec::new();
  }

  let mut out = vec![lang.to_string()];
  let base = lang.split(['-', '_']).next().unwrap_or_default().trim();
  if !base.is_empty() && !base.eq_ignore_ascii_case(lang) {
    out.push(base.to_string());
  }
  out
}

pub fn build_output_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
  partial_download: Option<&PartialDownloadOverride>,
) -> Vec<String> {
  let mut args = vec!["--output-na-placeholder".into(), "None".into()];

  match format_options.track_type {
    TrackType::Audio => match output_settings.audio.policy {
      TranscodePolicy::Never => {
        if output_settings.add_thumbnail
          && output_settings.audio.format.supports_embedded_thumbnail()
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

        // Set audio quality to highest if:
        // 1. We are re-encoding audio.
        // 2. The audio format supports audio quality selection, it is lossy.
        // 3. No ABR is selected, which means we want the best.
        if output_settings
          .audio
          .format
          .supports_audio_quality_selection()
        {
          args.push("--audio-quality".into());
          if let Some(abr) = format_options.abr {
            args.push(format!("{abr}k"));
          } else {
            args.push("0".into());
          }
        }

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
        let container = match output_settings.video.container {
          VideoContainer::Mp4 => "mp4",
          VideoContainer::Mkv => "mkv",
        };
        args.push("--merge-output-format".into());
        args.push(container.into());
        args.push("--remux-video".into());
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

  if let Some(value) = build_download_sections_arg(partial_download) {
    args.push("--download-sections".into());
    args.push(value);
  }

  if partial_download.is_some_and(|value| value.section.is_some()) {
    // Embedding chapters breaks the video when downloading a section, as the chapter metadata track is longer than the video.
    args.push("--no-embed-chapters".into());
    // Ensure we don't get black screens or missing audio.
    args.push("--force-keyframes-at-cuts".into());
  }

  args
}

fn build_download_sections_arg(
  partial_download: Option<&PartialDownloadOverride>,
) -> Option<String> {
  let partial_download = partial_download?;
  partial_download
    .section
    .as_ref()
    .map(build_download_section)
}

fn build_download_section(section: &DownloadSection) -> String {
  format!("*{}-{}", section.start, section.end)
}

pub fn build_location_args(
  track_type: &TrackType,
  template_context: &TemplateContext,
  output_settings: &OutputSettings,
  path_preferences: &PathPreferences,
  fallback_dir: PathBuf,
) -> Vec<String> {
  let global_dir = if let Some(dir) = &output_settings.download_dir {
    PathBuf::from(dir)
  } else {
    fallback_dir
  };

  let base_dir = match track_type {
    TrackType::Both | TrackType::Video => {
      if let Some(dir) = &path_preferences.video_download_dir {
        PathBuf::from(dir)
      } else {
        global_dir.clone()
      }
    }
    TrackType::Audio => {
      if let Some(dir) = &path_preferences.audio_download_dir {
        PathBuf::from(dir)
      } else {
        global_dir.clone()
      }
    }
  };

  let prefix_dir = match track_type {
    TrackType::Both | TrackType::Video => path_preferences.video_directory_template.clone(),
    TrackType::Audio => path_preferences.audio_directory_template.clone(),
  };

  let filename = match track_type {
    TrackType::Both | TrackType::Video => output_settings.file_name_template.clone(),
    TrackType::Audio => output_settings.audio_file_name_template.clone(),
  };

  let output_path = base_dir.join(prefix_dir).join(filename);
  let output_str = output_path.to_string_lossy();
  let rendered_output_str = template_context.render_template(output_str.as_ref());

  vec!["-o".into(), rendered_output_str]
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::models::download::{
    AudioFormat, DownloadSection, FormatOptions, PartialDownloadOverride, TranscodePolicy,
    VideoContainer,
  };
  use crate::models::TrackType;
  use crate::state::config_models::OutputSettings;

  fn make_audio_format_options(abr: Option<u32>) -> FormatOptions {
    FormatOptions {
      track_type: TrackType::Audio,
      abr,
      height: None,
      fps: None,
      audio_encoding: None,
      video_encoding: None,
      audio_track: None,
      video_track: None,
    }
  }

  fn make_video_format_options(height: Option<u32>, fps: Option<u32>) -> FormatOptions {
    FormatOptions {
      track_type: TrackType::Video,
      abr: None,
      height,
      fps,
      audio_encoding: None,
      video_encoding: None,
      audio_track: None,
      video_track: None,
    }
  }

  fn make_both_format_options(height: Option<u32>, fps: Option<u32>) -> FormatOptions {
    FormatOptions {
      track_type: TrackType::Both,
      abr: None,
      height,
      fps,
      audio_encoding: None,
      video_encoding: None,
      audio_track: None,
      video_track: None,
    }
  }

  #[test]
  fn audio_format_args_include_track_and_encoding_preferences() {
    let mut format_options = make_audio_format_options(Some(128));
    format_options.audio_track = Some("lang:en|channels:2".into());
    format_options.audio_encoding = Some("aac".into());
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);
    assert_eq!(
      args,
      vec![
        "-x",
        "-f",
        "ba[language=en]/ba/best",
        "-S",
        "lang:en,channels:2,abr~128,acodec:aac,aext:mp3",
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn video_format_args_include_track_and_encoding_preferences() {
    let mut format_options = make_video_format_options(Some(1080), Some(60));
    format_options.video_track = Some("lang:ja".into());
    format_options.video_encoding = Some("avc1".into());
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);
    assert_eq!(
      args,
      vec![
        "-f",
        "bv*[language=ja]/b[language=ja]/bv/b",
        "-S",
        "lang:ja,res:1080,fps:60,vcodec:avc1,vext:mp4,vext:m4a",
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn both_format_args_include_audio_and_video_encoding_preferences() {
    let mut format_options = make_both_format_options(Some(720), Some(30));
    format_options.audio_track = Some("lang:fr-FR".into());
    format_options.video_track = Some("lang:fr-FR".into());
    format_options.video_encoding = Some("vp9".into());
    format_options.audio_encoding = Some("opus".into());
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);
    assert_eq!(
      args,
      vec![
        "-f",
        "b[language=fr-FR]/bv*+ba[language=fr-FR]/bv+ba[language=fr-FR]/b[language=fr]/bv*+ba[language=fr]/bv+ba[language=fr]/bv*+ba/b",
        "-S",
        "lang:fr-FR,res:720,fps:30,vcodec:vp9,acodec:opus,vext:mp4,vext:m4a",
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn audio_format_args_without_abr() {
    let format_options = make_audio_format_options(None);
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);

    let expected: Vec<String> = vec!["-x", "-f", "ba/best", "-S", "lang,aext:mp3"]
      .into_iter()
      .map(String::from)
      .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn audio_format_args_with_abr() {
    let format_options = make_audio_format_options(Some(44));
    let settings = OutputSettings::default();

    let args = build_format_args(&format_options, &settings);

    let expected: Vec<String> = vec!["-x", "-f", "ba/best", "-S", "lang,abr~44,aext:mp3"]
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
      "bv*+ba/b",
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

    let args = build_output_args(&format_options, &settings, None);

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
      "--embed-thumbnail",
      "--add-metadata",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    assert_eq!(args, expected);
  }

  #[test]
  fn audio_output_args_allow_reencode_mp3_best() {
    let format_options = make_audio_format_options(None);

    let mut settings = OutputSettings::default();
    settings.audio.policy = TranscodePolicy::AllowReencode;
    settings.audio.format = AudioFormat::Mp3;

    let args = build_output_args(&format_options, &settings, None);

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
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
    let format_options = make_audio_format_options(Some(160));

    let mut settings = OutputSettings::default();
    settings.audio.policy = TranscodePolicy::AllowReencode;
    settings.audio.format = AudioFormat::Ogg;

    let args = build_output_args(&format_options, &settings, None);

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
      "--audio-format",
      "ogg",
      "--audio-quality",
      "160k",
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

    let args = build_output_args(&format_options, &settings, None);

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
      "--embed-thumbnail",
      "--add-metadata",
    ]
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

    let args = build_output_args(&format_options, &settings, None);

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
      "--merge-output-format",
      "mp4",
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

    let args = build_output_args(&format_options, &settings, None);

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
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

    let args = build_output_args(&format_options, &settings, None);

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
      "--merge-output-format",
      "mp4",
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

    let args = build_output_args(&format_options, &settings, None);

    assert!(args.contains(&"--restrict-filenames".to_string()));
  }

  #[test]
  fn restrict_filenames_omits_flag_on_disable() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.restrict_filenames = false;

    let args = build_output_args(&format_options, &settings, None);

    assert!(!args.contains(&"--restrict-filenames".to_string()));
  }

  #[test]
  fn partial_download_adds_download_sections_arg() {
    let format_options = make_video_format_options(Some(720), Some(60));
    let settings = OutputSettings::default();
    let partial_download = PartialDownloadOverride {
      section: Some(DownloadSection {
        id: "a".into(),
        start: "00:01:30".into(),
        end: "00:02:45".into(),
      }),
    };

    let args = build_output_args(&format_options, &settings, Some(&partial_download));

    assert!(args.contains(&"--download-sections".to_string()));
    assert!(args.contains(&"--no-embed-chapters".to_string()));
    assert!(args.contains(&"--force-keyframes-at-cuts".to_string()));
    assert_eq!(
      args
        .windows(2)
        .filter(|pair| pair[0] == "--download-sections")
        .map(|pair| pair[1].clone())
        .collect::<Vec<_>>(),
      vec!["*00:01:30-00:02:45".to_string()],
    );
  }

  #[test]
  fn partial_download_omits_arg_when_empty() {
    let format_options = make_video_format_options(Some(720), Some(60));
    let settings = OutputSettings::default();
    let empty = PartialDownloadOverride { section: None };

    let empty_args = build_output_args(&format_options, &settings, Some(&empty));

    assert!(!empty_args.contains(&"--download-sections".to_string()));
  }
}
