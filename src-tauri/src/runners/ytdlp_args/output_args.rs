use crate::models::download::{
  AudioFormat, AudioPostprocessPreset, FormatOptions, PartialDownloadOverride, TranscodePolicy,
  VideoContainer, VideoPostprocessMode, VideoPostprocessPreset,
};
use crate::models::TrackType;
use crate::state::config_models::{AudioOutputSettings, OutputSettings, VideoOutputSettings};
use shlex::split as shell_split;

pub fn build_output_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
  partial_download: Option<&PartialDownloadOverride>,
) -> Result<Vec<String>, String> {
  let mut args = vec!["--output-na-placeholder".into(), "".into()];
  let video_postprocess_plan = matches!(
    format_options.track_type,
    TrackType::Video | TrackType::Both
  )
  .then(|| resolve_video_postprocess_plan(&output_settings.video))
  .transpose()?;

  match format_options.track_type {
    TrackType::Audio => push_audio_output_args(&mut args, format_options, output_settings),
    TrackType::Video | TrackType::Both => {
      let plan = video_postprocess_plan
        .as_ref()
        .expect("video postprocess plan should be resolved");
      push_video_output_args(&mut args, plan, output_settings);
    }
  }

  if let Some(postprocessor_args) = video_postprocess_plan.and_then(|plan| plan.postprocessor_args)
  {
    args.push("--postprocessor-args".into());
    args.push(postprocessor_args);
  }

  args.extend(build_audio_ffmpeg_postprocess_args(&output_settings.audio)?);
  push_common_output_flags(&mut args, output_settings, partial_download);

  Ok(args)
}

fn push_audio_output_args(
  args: &mut Vec<String>,
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
) {
  match output_settings.audio.policy {
    TranscodePolicy::Never => {
      if output_settings.add_thumbnail && output_settings.audio.format.supports_embedded_thumbnail()
      {
        args.push("--embed-thumbnail".into());
      }
    }
    TranscodePolicy::AllowReencode => {
      args.push("--audio-format".into());
      args.push(audio_format_arg(output_settings.audio.format).into());

      if output_settings
        .audio
        .format
        .supports_audio_quality_selection()
      {
        args.push("--audio-quality".into());
        match format_options.abr {
          Some(abr) => args.push(format!("{abr}k")),
          None => args.push("0".into()),
        }
      }

      if output_settings.add_thumbnail && output_settings.audio.format.supports_embedded_thumbnail()
      {
        args.push("--embed-thumbnail".into());
      }
    }
  }
}

fn push_video_output_args(
  args: &mut Vec<String>,
  plan: &VideoPostprocessPlan,
  output_settings: &OutputSettings,
) {
  match plan.operation {
    VideoPostprocessOperation::None => {
      if output_settings.add_thumbnail {
        args.push("--embed-thumbnail".into());
      }
    }
    VideoPostprocessOperation::Remux => {
      let container = plan.container.expect("remux plan should have a container");
      args.push("--merge-output-format".into());
      args.push(container.into());
      args.push("--remux-video".into());
      args.push(container.into());

      if output_settings.add_thumbnail {
        args.push("--embed-thumbnail".into());
      }
    }
    VideoPostprocessOperation::Reencode => {
      let container = plan
        .container
        .expect("reencode plan should have a container");
      args.push("--recode-video".into());
      args.push(container.into());

      if output_settings.add_thumbnail {
        args.push("--embed-thumbnail".into());
      }
    }
  }
}

fn push_common_output_flags(
  args: &mut Vec<String>,
  output_settings: &OutputSettings,
  partial_download: Option<&PartialDownloadOverride>,
) {
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
    args.push("--no-embed-chapters".into());
    if output_settings.precise_cuts {
      args.push("--force-keyframes-at-cuts".into());
    }
  }
}

fn audio_format_arg(format: AudioFormat) -> &'static str {
  match format {
    AudioFormat::Mp3 => "mp3",
    AudioFormat::M4a => "m4a",
    AudioFormat::Opus => "opus",
    AudioFormat::Aac => "aac",
    AudioFormat::Ogg => "ogg",
    AudioFormat::Flac => "flac",
    AudioFormat::Wav => "wav",
  }
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
  video: &VideoOutputSettings,
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

fn ensure_video_reencode_allowed(video: &VideoOutputSettings, message: &str) -> Result<(), String> {
  if matches!(video.policy, TranscodePolicy::Never) {
    Err(message.to_string())
  } else {
    Ok(())
  }
}

fn build_audio_ffmpeg_postprocess_args(audio: &AudioOutputSettings) -> Result<Vec<String>, String> {
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
  partial_download?
    .section
    .as_ref()
    .map(build_download_section)
}

fn build_download_section(section: &crate::models::download::DownloadSection) -> String {
  format!("*{}-{}", section.start, section.end)
}
