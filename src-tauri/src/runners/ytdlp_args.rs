use crate::models::download::{
  AudioFormat, AudioPostprocessPreset, DownloadSection, FormatOptions, PartialDownloadOverride,
  TranscodePolicy, VideoContainer, VideoPostprocessMode, VideoPostprocessPreset,
};
use crate::models::TrackType;
use crate::runners::template_context::TemplateContext;
use crate::state::config_models::OutputSettings;
use crate::state::preferences_models::PathPreferences;
use shlex::split as shell_split;
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
      let audio_encoding = format_options
        .audio_encoding
        .as_ref()
        .filter(|value| !value.trim().is_empty());
      let mut selectors = Vec::new();
      if let Some(language) = audio_track_pref.language.as_ref() {
        let langs = language_candidates(language);
        if let Some(acodec) = audio_encoding {
          for lang in &langs {
            selectors.push(format!("ba[acodec^={acodec}][language={lang}]"));
          }
        }
        for lang in &langs {
          selectors.extend([
            format!("ba[language={lang}]"),
            format!("b[language={lang}]"),
          ]);
        }
      }
      if let Some(acodec) = audio_encoding {
        selectors.push(format!("ba[acodec^={acodec}]"));
      }
      selectors.extend(["ba".into(), "b".into()]);
      args.push(selectors.join("/"));

      let mut sort_fields = Vec::new();

      if audio_track_pref.language.is_none() {
        sort_fields.push("lang".into());
      }
      if let Some(channels) = audio_track_pref.channels {
        sort_fields.push(format!("channels:{channels}"));
      }

      if let Some(abr) = format_options.abr {
        sort_fields.push(format!("abr~{abr}"));
      }

      if !sort_fields.is_empty() {
        let sort_arg = sort_fields.join(",");

        args.push("-S".into());
        args.push(sort_arg);
      }
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
                  format!("bv[language={lang}]"),
                  format!("b[language={lang}]"),
                ]
              })
              .collect();
            selectors.extend(["bv".into(), "b".into()]);
            selectors.join("/")
          } else {
            "bv/b".to_string()
          }
        }
        TrackType::Both => {
          if let Some(language) = audio_track_pref.language.as_ref() {
            let candidates = language_candidates(language);
            let mut selectors: Vec<String> = candidates
              .iter()
              .flat_map(|lang| {
                [
                  format!("bv*+ba[language={lang}]"),
                  format!("b[language={lang}]"),
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

      if let Some(video_encoding) = format_options
        .video_encoding
        .as_ref()
        .filter(|value| !value.trim().is_empty())
      {
        sort_fields.push(format!("vcodec:{video_encoding}"));
      }
      if video_track_pref.language.is_none() && audio_track_pref.language.is_none() {
        sort_fields.push("lang".into());
      }
      if let Some(h) = format_options.height {
        sort_fields.push(format!("res:{h}"));
      }
      if let Some(f) = format_options.fps {
        sort_fields.push(format!("fps:{f}"));
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

      if !sort_fields.is_empty() {
        let sort_arg = sort_fields.join(",");

        args.push("-S".into());
        args.push(sort_arg);
      }
    }
  }

  args
}

// fn acodec_filters(format: AudioFormat) -> &'static [&'static str] {
//   match format {
//     AudioFormat::M4a | AudioFormat::Aac => &["aac", "mp4a.40."],
//     AudioFormat::Opus => &["opus"],
//     AudioFormat::Ogg => &["ogg", "vorbis"],
//     AudioFormat::Flac | AudioFormat::Wav => &["flac", "wav"],
//     AudioFormat::Mp3 => &["mp3"],
//   }
// }

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
) -> Result<Vec<String>, String> {
  let mut args = vec!["--output-na-placeholder".into(), "None".into()];
  let video_postprocess_plan = if matches!(
    format_options.track_type,
    TrackType::Video | TrackType::Both
  ) {
    Some(resolve_video_postprocess_plan(&output_settings.video)?)
  } else {
    None
  };

  match format_options.track_type {
    TrackType::Audio => match output_settings.audio.policy {
      TranscodePolicy::Never => {
        if output_settings.add_thumbnail
          && output_settings.audio.format.supports_embedded_thumbnail()
        {
          args.push("--embed-thumbnail".into());
        }
      }
      TranscodePolicy::AllowReencode => {
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

    TrackType::Video | TrackType::Both => match video_postprocess_plan
      .as_ref()
      .expect("video postprocess plan should be resolved")
      .operation
    {
      VideoPostprocessOperation::None => {
        if output_settings.add_thumbnail {
          args.push("--embed-thumbnail".into());
        }
      }
      VideoPostprocessOperation::Remux => {
        let container = video_postprocess_plan
          .as_ref()
          .and_then(|plan| plan.container)
          .expect("remux plan should have a container");
        args.push("--merge-output-format".into());
        args.push(container.into());
        args.push("--remux-video".into());
        args.push(container.into());

        if output_settings.add_thumbnail {
          args.push("--embed-thumbnail".into());
        }
      }
      VideoPostprocessOperation::Reencode => {
        let container = video_postprocess_plan
          .as_ref()
          .and_then(|plan| plan.container)
          .expect("reencode plan should have a container");
        args.push("--recode-video".into());
        args.push(container.into());

        if output_settings.add_thumbnail {
          args.push("--embed-thumbnail".into());
        }
      }
    },
  }

  if let Some(postprocessor_args) = video_postprocess_plan.and_then(|plan| plan.postprocessor_args)
  {
    args.push("--postprocessor-args".into());
    args.push(postprocessor_args);
  }
  args.extend(build_audio_ffmpeg_postprocess_args(&output_settings.audio)?);

  if output_settings.add_metadata {
    args.push("--add-metadata".into());
  }

  if output_settings.save_thumbnail {
    args.push("--write-thumbnail".into());
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
    if output_settings.video.policy == TranscodePolicy::AllowReencode {
      // Ensure we don't get black screens or missing audio.
      args.push("--force-keyframes-at-cuts".into());
    }
  }

  Ok(args)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VideoPostprocessOperation {
  None,
  Remux,
  Reencode,
}

#[derive(Debug)]
struct VideoPostprocessPlan {
  operation: VideoPostprocessOperation,
  container: Option<&'static str>,
  postprocessor_args: Option<String>,
}

fn resolve_video_postprocess_plan(
  video: &crate::state::config_models::VideoOutputSettings,
) -> Result<VideoPostprocessPlan, String> {
  let container = match video.container {
    VideoContainer::Mp4 => "mp4",
    VideoContainer::Mkv => "mkv",
  };
  let base_operation = match video.policy {
    TranscodePolicy::Never => VideoPostprocessOperation::None,
    TranscodePolicy::AllowReencode => VideoPostprocessOperation::Remux,
  };

  let base_plan = || VideoPostprocessPlan {
    operation: base_operation,
    container: match base_operation {
      VideoPostprocessOperation::None => None,
      VideoPostprocessOperation::Remux | VideoPostprocessOperation::Reencode => Some(container),
    },
    postprocessor_args: None,
  };

  match video.postprocess_preset {
    VideoPostprocessPreset::None => Ok(base_plan()),
    VideoPostprocessPreset::Fps30 => {
      ensure_video_reencode_allowed(
        video,
        "The 30 fps preset requires re-encoding. Disable Keep original streams to use it.",
      )?;
      Ok(VideoPostprocessPlan {
        operation: VideoPostprocessOperation::Reencode,
        container: Some(container),
        postprocessor_args: Some("VideoConvertor+ffmpeg:-vf fps=30".into()),
      })
    }
    VideoPostprocessPreset::Mp42 => {
      if !matches!(video.container, VideoContainer::Mp4) {
        return Err("The mp42 preset requires mp4 output.".into());
      }
      Ok(VideoPostprocessPlan {
        operation: VideoPostprocessOperation::Remux,
        container: Some(container),
        postprocessor_args: Some("VideoRemuxer+ffmpeg:-brand mp42".into()),
      })
    }
    VideoPostprocessPreset::Custom => {
      let Some(custom_args) = parse_custom_postprocess_args(&video.postprocess_args)? else {
        return Ok(base_plan());
      };

      match video.custom_postprocess_mode {
        VideoPostprocessMode::Remux => Ok(VideoPostprocessPlan {
          operation: VideoPostprocessOperation::Remux,
          container: Some(container),
          postprocessor_args: Some(format!("VideoRemuxer+ffmpeg:{custom_args}")),
        }),
        VideoPostprocessMode::Reencode => {
          ensure_video_reencode_allowed(
            video,
            "Custom video post-processing in re-encode mode requires re-encoding. Disable Keep original streams to use it.",
          )?;
          Ok(VideoPostprocessPlan {
            operation: VideoPostprocessOperation::Reencode,
            container: Some(container),
            postprocessor_args: Some(format!("VideoConvertor+ffmpeg:{custom_args}")),
          })
        }
      }
    }
  }
}

fn ensure_video_reencode_allowed(
  video: &crate::state::config_models::VideoOutputSettings,
  message: &str,
) -> Result<(), String> {
  if matches!(video.policy, TranscodePolicy::Never) {
    Err(message.to_string())
  } else {
    Ok(())
  }
}

fn build_audio_ffmpeg_postprocess_args(
  audio: &crate::state::config_models::AudioOutputSettings,
) -> Result<Vec<String>, String> {
  let mut args = Vec::new();

  if matches!(audio.postprocess_preset, AudioPostprocessPreset::Custom) {
    if let Some(custom_args) = parse_custom_postprocess_args(&audio.postprocess_args)? {
      args.push("--postprocessor-args".into());
      args.push(format!("ffmpeg:{custom_args}"));
    }
  }

  Ok(args)
}

fn parse_custom_postprocess_args(raw: &str) -> Result<Option<String>, String> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Ok(None);
  }

  shell_split(trimmed)
    .map(|_| Some(trimmed.to_string()))
    .ok_or_else(|| "Invalid custom ffmpeg arguments. Check your quotes and spacing.".into())
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
    AudioFormat, AudioPostprocessPreset, DownloadSection, FormatOptions, PartialDownloadOverride,
    TranscodePolicy, VideoContainer, VideoPostprocessMode, VideoPostprocessPreset,
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
        "ba[acodec^=aac][language=en]/ba[language=en]/b[language=en]/ba[acodec^=aac]/ba/b",
        "-S",
        "channels:2,abr~128",
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
        "bv[language=ja]/b[language=ja]/bv/b",
        "-S",
        "vcodec:avc1,res:1080,fps:60",
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
        "bv*+ba[language=fr-FR]/b[language=fr-FR]/bv*+ba[language=fr]/b[language=fr]/bv*+ba/b",
        "-S",
        "vcodec:vp9,res:720,fps:30,acodec:opus",
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

    let expected: Vec<String> = vec!["-x", "-f", "ba[acodec^=mp3]/ba/b", "-S", "lang"]
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

    let expected: Vec<String> = vec!["-x", "-f", "ba[acodec^=mp3]/ba/b", "-S", "lang,abr~44"]
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

    let expected: Vec<String> = vec!["-f", "bv/b", "-S", "lang,res:720,fps:60"]
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

    let expected: Vec<String> = vec!["-f", "bv/b", "-S", "lang,res:720,fps:60"]
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

    let expected: Vec<String> = vec!["-f", "bv*+ba/b", "-S", "lang,res:1080,fps:30"]
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

    let args = build_output_args(&format_options, &settings, None).unwrap();

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

    let args = build_output_args(&format_options, &settings, None).unwrap();

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

    let args = build_output_args(&format_options, &settings, None).unwrap();

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
  fn audio_output_args_custom_postprocess_adds_ffmpeg_args() {
    let format_options = make_audio_format_options(None);

    let mut settings = OutputSettings::default();
    settings.audio.policy = TranscodePolicy::AllowReencode;
    settings.audio.postprocess_preset = AudioPostprocessPreset::Custom;
    settings.audio.postprocess_args = "-metadata artist=Example".into();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert_eq!(
      args,
      vec![
        "--output-na-placeholder",
        "None",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--postprocessor-args",
        "ffmpeg:-metadata artist=Example",
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn video_output_args_never_policy_produces_no_flags() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.container = VideoContainer::Mp4;

    let args = build_output_args(&format_options, &settings, None).unwrap();

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
  fn video_output_args_allow_reencode_remuxes_mp4() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::AllowReencode;
    settings.video.container = VideoContainer::Mp4;

    let args = build_output_args(&format_options, &settings, None).unwrap();

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
  fn video_output_args_allow_reencode_remuxes_mkv() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::AllowReencode;
    settings.video.container = VideoContainer::Mkv;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    let expected: Vec<String> = vec![
      "--output-na-placeholder",
      "None",
      "--merge-output-format",
      "mkv",
      "--remux-video",
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
  fn video_output_args_none_preset_produces_no_postprocessor_args() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.postprocess_preset = VideoPostprocessPreset::None;
    settings.video.postprocess_args = String::new();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert!(!args.contains(&"--postprocessor-args".to_string()));
  }

  #[test]
  fn video_output_args_fps30_errors_when_keep_original_streams_enabled() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.postprocess_preset = VideoPostprocessPreset::Fps30;
    settings.video.postprocess_args = String::new();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let err = build_output_args(&format_options, &settings, None).unwrap_err();

    assert_eq!(
      err,
      "The 30 fps preset requires re-encoding. Disable Keep original streams to use it."
    );
  }

  #[test]
  fn video_output_args_fps30_reencodes_when_allowed() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::AllowReencode;
    settings.video.postprocess_preset = VideoPostprocessPreset::Fps30;
    settings.video.postprocess_args = String::new();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert_eq!(
      args,
      vec![
        "--output-na-placeholder",
        "None",
        "--recode-video",
        "mp4",
        "--postprocessor-args",
        "VideoConvertor+ffmpeg:-vf fps=30",
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn video_output_args_mp42_adds_brand_args_for_mp4_output() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.postprocess_preset = VideoPostprocessPreset::Mp42;
    settings.video.postprocess_args = String::new();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert_eq!(
      args,
      vec![
        "--output-na-placeholder",
        "None",
        "--merge-output-format",
        "mp4",
        "--remux-video",
        "mp4",
        "--postprocessor-args",
        "VideoRemuxer+ffmpeg:-brand mp42",
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn video_output_args_mp42_errors_for_non_mp4_output() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.container = VideoContainer::Mkv;
    settings.video.postprocess_preset = VideoPostprocessPreset::Mp42;
    settings.video.postprocess_args = String::new();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let err = build_output_args(&format_options, &settings, None).unwrap_err();

    assert_eq!(err, "The mp42 preset requires mp4 output.");
  }

  #[test]
  fn video_output_args_custom_preset_remuxes_with_explicit_mode() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.postprocess_preset = VideoPostprocessPreset::Custom;
    settings.video.custom_postprocess_mode = VideoPostprocessMode::Remux;
    settings.video.postprocess_args = r#"-metadata synopsis="My Video""#.into();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert_eq!(
      args,
      vec![
        "--output-na-placeholder",
        "None",
        "--merge-output-format",
        "mp4",
        "--remux-video",
        "mp4",
        "--postprocessor-args",
        r#"VideoRemuxer+ffmpeg:-metadata synopsis="My Video""#,
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn video_output_args_custom_preset_reencodes_when_explicit_mode_requires_it() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::AllowReencode;
    settings.video.postprocess_preset = VideoPostprocessPreset::Custom;
    settings.video.custom_postprocess_mode = VideoPostprocessMode::Reencode;
    settings.video.postprocess_args = "-movflags +faststart".into();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert_eq!(
      args,
      vec![
        "--output-na-placeholder",
        "None",
        "--recode-video",
        "mp4",
        "--postprocessor-args",
        "VideoConvertor+ffmpeg:-movflags +faststart",
      ]
      .into_iter()
      .map(String::from)
      .collect::<Vec<_>>()
    );
  }

  #[test]
  fn video_output_args_custom_reencode_errors_when_keep_original_streams_enabled() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.video.postprocess_preset = VideoPostprocessPreset::Custom;
    settings.video.custom_postprocess_mode = VideoPostprocessMode::Reencode;
    settings.video.postprocess_args = "-movflags +faststart".into();
    settings.add_thumbnail = false;
    settings.add_metadata = false;

    let err = build_output_args(&format_options, &settings, None).unwrap_err();

    assert_eq!(
      err,
      "Custom video post-processing in re-encode mode requires re-encoding. Disable Keep original streams to use it."
    );
  }

  #[test]
  fn both_track_type_uses_video_policy_for_output() {
    let format_options = make_both_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::AllowReencode;
    settings.video.container = VideoContainer::Mp4;

    let args = build_output_args(&format_options, &settings, None).unwrap();

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

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert!(args.contains(&"--restrict-filenames".to_string()));
  }

  #[test]
  fn restrict_filenames_omits_flag_on_disable() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.restrict_filenames = false;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert!(!args.contains(&"--restrict-filenames".to_string()));
  }

  #[test]
  fn save_thumbnail_adds_write_thumbnail_flag() {
    let format_options = make_video_format_options(Some(720), Some(60));

    let mut settings = OutputSettings::default();
    settings.video.policy = TranscodePolicy::Never;
    settings.save_thumbnail = true;

    let args = build_output_args(&format_options, &settings, None).unwrap();

    assert!(args.contains(&"--write-thumbnail".to_string()));
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

    let args = build_output_args(&format_options, &settings, Some(&partial_download)).unwrap();

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

    let empty_args = build_output_args(&format_options, &settings, Some(&empty)).unwrap();

    assert!(!empty_args.contains(&"--download-sections".to_string()));
  }
}
