use super::{build_format_args, build_input_filter_args, build_location_args, build_output_args};
use crate::models::download::{
  AudioFormat, AudioPostprocessPreset, DownloadSection, FormatOptions, InputFilterOptions,
  PartialDownloadOverride, PlaylistMode, TranscodePolicy, VideoContainer, VideoPostprocessMode,
  VideoPostprocessPreset,
};
use crate::models::TrackType;
use crate::runners::template_context::TemplateContext;
use crate::state::config_models::OutputSettings;
use crate::state::preferences_models::PathPreferences;
use std::collections::HashMap;
use std::path::PathBuf;

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
fn input_filter_args_include_supported_filters() {
  let args = build_input_filter_args(Some(&InputFilterOptions {
    playlist_items: Some("1:3".into()),
    min_filesize: Some("10M".into()),
    max_filesize: Some("250M".into()),
    date: Some("today-2weeks".into()),
    datebefore: Some("20250101".into()),
    dateafter: Some("20240101".into()),
    match_filters: Some("!is_live".into()),
    break_match_filters: Some("duration >? 3600".into()),
    playlist_mode: Some(PlaylistMode::SingleVideo),
  }));

  assert_eq!(
    args,
    vec![
      "-I",
      "1:3",
      "--min-filesize",
      "10M",
      "--max-filesize",
      "250M",
      "--date",
      "today-2weeks",
      "--datebefore",
      "20250101",
      "--dateafter",
      "20240101",
      "--match-filters",
      "!is_live",
      "--break-match-filters",
      "duration >? 3600",
      "--no-playlist",
    ]
    .into_iter()
    .map(String::from)
    .collect::<Vec<_>>()
  );
}

#[test]
fn input_filter_args_omit_empty_values() {
  let args = build_input_filter_args(Some(&InputFilterOptions {
    playlist_items: Some("   ".into()),
    min_filesize: None,
    max_filesize: None,
    date: None,
    datebefore: None,
    dateafter: None,
    match_filters: Some("   ".into()),
    break_match_filters: None,
    playlist_mode: Some(PlaylistMode::Playlist),
  }));

  assert_eq!(args, vec!["--yes-playlist".to_string()]);
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
  assert_eq!(args[0], "-f");
  assert!(args[1].contains("bv*[language=ja][height<=1080][fps<=60]"));
  assert!(args[1].contains("b[language=ja][height<=1080][fps<=60]"));
  assert!(args[1].contains("/bv/"));
  assert!(args[1].ends_with("/b"));
  assert_eq!(args[2], "-S");
  assert_eq!(
    args[3],
    "lang:ja,height:1080,fps:60,vcodec:avc1,vext:mp4,vext:m4a"
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
  assert_eq!(args[0], "-f");
  assert!(args[1].contains("b[language=fr-FR][height<=720][fps<=30]"));
  assert!(args[1].contains("bv*[height<=720][fps<=30]+ba[language=fr-FR]"));
  assert!(args[1].contains("b[language=fr][height<=720][fps<=30]"));
  assert!(args[1].contains("bv*+ba/b"));
  assert_eq!(args[2], "-S");
  assert_eq!(
    args[3],
    "lang:fr-FR,height:720,fps:30,vcodec:vp9,acodec:opus,vext:mp4,vext:m4a"
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
  let settings = OutputSettings::default();

  let args = build_format_args(&format_options, &settings);

  let expected: Vec<String> = vec![
    "-f",
    "bv[height<=720][fps<=60]/bv[height<=720]/bv[fps<=60]/bv/b[height<=720][fps<=60]/b[height<=720]/b[fps<=60]/b",
    "-S",
    "lang,height:720,fps:60,vcodec:avc1,vext:mp4,vext:m4a",
  ]
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

  let expected: Vec<String> = vec![
    "-f",
    "bv[height<=720][fps<=60]/bv[height<=720]/bv[fps<=60]/bv/b[height<=720][fps<=60]/b[height<=720]/b[fps<=60]/b",
    "-S",
    "lang,height:720,fps:60,vext",
  ]
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
    "bv*[height<=1080][fps<=30]+ba/b[height<=1080][fps<=30]/bv*[height<=1080]+ba/b[height<=1080]/bv*[fps<=30]+ba/b[fps<=30]/bv*+ba/b",
    "-S",
    "lang,height:1080,fps:30,vcodec:avc1,acodec:aac,vext:mp4,vext:m4a",
  ]
  .into_iter()
  .map(String::from)
  .collect();

  assert_eq!(args, expected);
}

#[test]
fn video_format_args_with_mp4_bias_prefers_avc1() {
  let format_options = make_video_format_options(Some(720), Some(60));
  let settings = OutputSettings::default();

  let args = build_format_args(&format_options, &settings);

  let expected: Vec<String> = vec![
    "-f",
    "bv[height<=720][fps<=60]/bv[height<=720]/bv[fps<=60]/bv/b[height<=720][fps<=60]/b[height<=720]/b[fps<=60]/b",
    "-S",
    "lang,height:720,fps:60,vcodec:avc1,vext:mp4,vext:m4a",
  ]
  .into_iter()
  .map(String::from)
  .collect();

  assert_eq!(args, expected);
}

#[test]
fn both_format_args_with_mp4_bias_prefers_avc1_and_aac() {
  let format_options = make_both_format_options(Some(1080), Some(30));
  let settings = OutputSettings::default();

  let args = build_format_args(&format_options, &settings);

  let expected: Vec<String> = vec![
    "-f",
    "bv*[height<=1080][fps<=30]+ba/b[height<=1080][fps<=30]/bv*[height<=1080]+ba/b[height<=1080]/bv*[fps<=30]+ba/b[fps<=30]/bv*+ba/b",
    "-S",
    "lang,height:1080,fps:30,vcodec:avc1,acodec:aac,vext:mp4,vext:m4a",
  ]
  .into_iter()
  .map(String::from)
  .collect();

  assert_eq!(args, expected);
}

#[test]
fn video_format_args_with_mkv_bias_does_not_prefer_avc1() {
  let format_options = make_video_format_options(Some(720), Some(60));

  let mut settings = OutputSettings::default();
  settings.video.container = VideoContainer::Mkv;

  let args = build_format_args(&format_options, &settings);

  let expected: Vec<String> = vec![
    "-f",
    "bv[height<=720][fps<=60]/bv[height<=720]/bv[fps<=60]/bv/b[height<=720][fps<=60]/b[height<=720]/b[fps<=60]/b",
    "-S",
    "lang,height:720,fps:60,vext",
  ]
    .into_iter()
    .map(String::from)
    .collect();

  assert_eq!(args, expected);
}

#[test]
fn both_format_args_with_explicit_audio_encoding_skips_default_aac_bias() {
  let mut format_options = make_both_format_options(Some(720), Some(30));
  format_options.audio_encoding = Some("opus".into());
  let settings = OutputSettings::default();

  let args = build_format_args(&format_options, &settings);

  let expected: Vec<String> = vec![
    "-f",
    "bv*[height<=720][fps<=30]+ba/b[height<=720][fps<=30]/bv*[height<=720]+ba/b[height<=720]/bv*[fps<=30]+ba/b[fps<=30]/bv*+ba/b",
    "-S",
    "lang,height:720,fps:30,vcodec:avc1,acodec:opus,vext:mp4,vext:m4a",
  ]
  .into_iter()
  .map(String::from)
  .collect();

  assert_eq!(args, expected);
}

#[test]
fn both_format_args_use_bounded_resolution_filters_for_4k_selection() {
  let format_options = make_both_format_options(Some(2160), Some(30));
  let settings = OutputSettings::default();

  let args = build_format_args(&format_options, &settings);

  let expected: Vec<String> = vec![
    "-f",
    "bv*[height<=2160][fps<=30]+ba/b[height<=2160][fps<=30]/bv*[height<=2160]+ba/b[height<=2160]/bv*[fps<=30]+ba/b[fps<=30]/bv*+ba/b",
    "-S",
    "lang,height:2160,fps:30,vcodec:avc1,acodec:aac,vext:mp4,vext:m4a",
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

  let args = build_output_args(&format_options, &settings, None).unwrap();

  let expected: Vec<String> = vec![
    "--output-na-placeholder",
    "",
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
    "",
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
    "",
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
      "",
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
    "",
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
    "",
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
    "",
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
      "",
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
      "",
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
      "",
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
      "",
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
    "",
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
  assert!(!args.contains(&"--force-keyframes-at-cuts".to_string()));
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
fn partial_download_precise_cuts_add_force_keyframes_at_cuts() {
  let format_options = make_video_format_options(Some(720), Some(60));
  let settings = OutputSettings {
    precise_cuts: true,
    ..OutputSettings::default()
  };
  let partial_download = PartialDownloadOverride {
    section: Some(DownloadSection {
      id: "a".into(),
      start: "00:01:30".into(),
      end: "00:02:45".into(),
    }),
  };

  let args = build_output_args(&format_options, &settings, Some(&partial_download)).unwrap();

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

#[test]
fn location_args_use_track_specific_preferences() {
  let template_context = TemplateContext {
    values: HashMap::new(),
  };
  let output = OutputSettings::default();
  let prefs = PathPreferences {
    audio_download_dir: Some("/tmp/audio".into()),
    video_download_dir: Some("/tmp/video".into()),
    video_directory_template: "%(playlist_title)s".into(),
    audio_directory_template: "%(uploader)s".into(),
  };

  let args = build_location_args(
    &TrackType::Video,
    &template_context,
    &output,
    &prefs,
    PathBuf::from("/tmp/fallback"),
  );

  assert_eq!(args[0], "-o");
  assert!(args[1].contains("/tmp/video"));
}
