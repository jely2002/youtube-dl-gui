use crate::models::download::{AudioFormat, FormatOptions, VideoContainer};
use crate::models::TrackType;
use crate::state::config_models::OutputSettings;

pub fn build_format_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
) -> Vec<String> {
  let audio_track_pref = TrackPreference::parse(format_options.audio_track.as_ref());
  let video_track_pref = TrackPreference::parse(format_options.video_track.as_ref());

  match format_options.track_type {
    TrackType::Audio => build_audio_format_args(format_options, output_settings, &audio_track_pref),
    TrackType::Video | TrackType::Both => build_video_format_args(
      format_options,
      output_settings,
      &audio_track_pref,
      &video_track_pref,
    ),
  }
}

fn build_audio_format_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
  audio_track_pref: &TrackPreference,
) -> Vec<String> {
  let selector = audio_selector(audio_track_pref);
  let sort_arg = audio_sort_fields(format_options, output_settings, audio_track_pref).render();

  vec!["-x".into(), "-f".into(), selector, "-S".into(), sort_arg]
}

fn build_video_format_args(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
  audio_track_pref: &TrackPreference,
  video_track_pref: &TrackPreference,
) -> Vec<String> {
  let selector_filter = SelectorFilter::from_format_options(format_options);
  let selector = match format_options.track_type {
    TrackType::Video => video_only_selector(&selector_filter, video_track_pref),
    TrackType::Both => combined_selector(&selector_filter, audio_track_pref, video_track_pref),
    TrackType::Audio => unreachable!(),
  };
  let sort_arg = video_sort_fields(
    format_options,
    output_settings,
    audio_track_pref,
    video_track_pref,
  )
  .render();

  vec!["-f".into(), selector, "-S".into(), sort_arg]
}

fn audio_selector(audio_track_pref: &TrackPreference) -> String {
  match audio_track_pref.language.as_deref() {
    Some(language) => {
      let mut selectors: Vec<String> = language_candidates(language)
        .into_iter()
        .map(|lang| format!("ba[language={lang}]"))
        .collect();
      selectors.extend(["ba".into(), "best".into()]);
      selectors.join("/")
    }
    None => "ba/best".into(),
  }
}

fn video_only_selector(
  selector_filter: &SelectorFilter,
  video_track_pref: &TrackPreference,
) -> String {
  match video_track_pref.language.as_deref() {
    Some(language) => {
      let mut selectors: Vec<String> = language_candidates(language)
        .into_iter()
        .flat_map(|lang| selector_filter.bounded_variants(&format!("bv*[language={lang}]")))
        .collect();
      selectors.extend(
        language_candidates(language)
          .into_iter()
          .flat_map(|lang| selector_filter.bounded_variants(&format!("b[language={lang}]"))),
      );
      selectors.extend(selector_filter.bounded_variants("bv"));
      selectors.extend(selector_filter.bounded_variants("b"));
      selectors.join("/")
    }
    None => {
      let mut selectors = selector_filter.bounded_variants("bv");
      selectors.extend(selector_filter.bounded_variants("b"));
      selectors.join("/")
    }
  }
}

fn combined_selector(
  selector_filter: &SelectorFilter,
  audio_track_pref: &TrackPreference,
  video_track_pref: &TrackPreference,
) -> String {
  if let Some(language) = audio_track_pref.language.as_deref() {
    let mut selectors: Vec<String> = language_candidates(language)
      .into_iter()
      .flat_map(|lang| {
        [
          selector_filter.apply_height_and_fps(&format!("b[language={lang}]")),
          format!(
            "{}+ba[language={lang}]",
            selector_filter.apply_height_and_fps("bv*")
          ),
          format!(
            "{}+ba[language={lang}]",
            selector_filter.apply_height_and_fps("bv")
          ),
          selector_filter.apply_height(&format!("b[language={lang}]")),
          format!(
            "{}+ba[language={lang}]",
            selector_filter.apply_height("bv*")
          ),
          format!("{}+ba[language={lang}]", selector_filter.apply_height("bv")),
          selector_filter.apply_fps(&format!("b[language={lang}]")),
          format!("{}+ba[language={lang}]", selector_filter.apply_fps("bv*")),
          format!("{}+ba[language={lang}]", selector_filter.apply_fps("bv")),
        ]
      })
      .collect();
    selectors.extend([
      format!("{}+ba", selector_filter.apply_height_and_fps("bv*")),
      selector_filter.apply_height_and_fps("b"),
      format!("{}+ba", selector_filter.apply_height("bv*")),
      selector_filter.apply_height("b"),
      format!("{}+ba", selector_filter.apply_fps("bv*")),
      selector_filter.apply_fps("b"),
      format!("{}+ba", selector_filter.apply("bv*")),
      selector_filter.apply("b"),
    ]);
    return selectors.join("/");
  }

  if let Some(language) = video_track_pref
    .language
    .as_deref()
    .or(audio_track_pref.language.as_deref())
  {
    let mut selectors: Vec<String> = language_candidates(language)
      .into_iter()
      .flat_map(|lang| {
        [
          format!(
            "{}+ba",
            selector_filter.apply_height_and_fps(&format!("bv*[language={lang}]"))
          ),
          selector_filter.apply_height_and_fps(&format!("b[language={lang}]")),
          format!(
            "{}+ba",
            selector_filter.apply_height(&format!("bv*[language={lang}]"))
          ),
          selector_filter.apply_height(&format!("b[language={lang}]")),
          format!(
            "{}+ba",
            selector_filter.apply_fps(&format!("bv*[language={lang}]"))
          ),
          selector_filter.apply_fps(&format!("b[language={lang}]")),
        ]
      })
      .collect();
    selectors.extend([
      format!("{}+ba", selector_filter.apply_height_and_fps("bv*")),
      selector_filter.apply_height_and_fps("b"),
      format!("{}+ba", selector_filter.apply_height("bv*")),
      selector_filter.apply_height("b"),
      format!("{}+ba", selector_filter.apply_fps("bv*")),
      selector_filter.apply_fps("b"),
      format!("{}+ba", selector_filter.apply("bv*")),
      selector_filter.apply("b"),
    ]);
    return selectors.join("/");
  }

  [
    format!("{}+ba", selector_filter.apply_height_and_fps("bv*")),
    selector_filter.apply_height_and_fps("b"),
    format!("{}+ba", selector_filter.apply_height("bv*")),
    selector_filter.apply_height("b"),
    format!("{}+ba", selector_filter.apply_fps("bv*")),
    selector_filter.apply_fps("b"),
    format!("{}+ba", selector_filter.apply("bv*")),
    selector_filter.apply("b"),
  ]
  .join("/")
}

fn audio_sort_fields(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
  audio_track_pref: &TrackPreference,
) -> FormatSort {
  let mut sort = FormatSort::new();
  sort.prefer_language(audio_track_pref.language.as_deref());

  if let Some(channels) = audio_track_pref.channels {
    sort.push(format!("channels:{channels}"));
  }

  if let Some(abr) = format_options.abr {
    sort.push(format!("abr~{abr}"));
  }

  sort.push_non_empty_prefixed("acodec", format_options.audio_encoding.as_deref());

  match output_settings.audio.format {
    AudioFormat::M4a | AudioFormat::Aac => {
      sort.push("aext:m4a");
      sort.push("acodec:aac");
    }
    AudioFormat::Opus => {
      sort.push("acodec:opus");
      sort.push("aext:webm");
    }
    AudioFormat::Ogg => {
      sort.push("aext:ogg");
      sort.push("acodec:vorbis");
    }
    AudioFormat::Flac | AudioFormat::Wav => sort.push("acodec:opus"),
    AudioFormat::Mp3 => sort.push("aext:mp3"),
  }

  sort
}

fn video_sort_fields(
  format_options: &FormatOptions,
  output_settings: &OutputSettings,
  audio_track_pref: &TrackPreference,
  video_track_pref: &TrackPreference,
) -> FormatSort {
  let mut sort = FormatSort::new();
  sort.prefer_language(
    video_track_pref
      .language
      .as_deref()
      .or(audio_track_pref.language.as_deref()),
  );

  if let Some(height) = format_options.height {
    sort.push(format!("height:{height}"));
  }

  if let Some(fps) = format_options.fps {
    sort.push(format!("fps:{fps}"));
  }

  if let Some(video_encoding) = non_empty(format_options.video_encoding.as_deref()) {
    sort.push(format!("vcodec:{video_encoding}"));
  } else if matches!(output_settings.video.container, VideoContainer::Mp4) {
    sort.push("vcodec:avc1");
  }

  if matches!(format_options.track_type, TrackType::Both) {
    if let Some(audio_encoding) = non_empty(format_options.audio_encoding.as_deref()) {
      sort.push(format!("acodec:{audio_encoding}"));
    } else if matches!(output_settings.video.container, VideoContainer::Mp4) {
      sort.push("acodec:aac");
    }
  }

  if matches!(output_settings.video.container, VideoContainer::Mp4) {
    sort.push("vext:mp4");
    sort.push("vext:m4a");
  } else {
    sort.push("vext");
  }

  sort
}

#[derive(Debug, Default)]
struct TrackPreference {
  language: Option<String>,
  channels: Option<u32>,
}

impl TrackPreference {
  fn parse(track: Option<&String>) -> Self {
    let Some(raw) = track else {
      return Self::default();
    };

    if raw.trim().is_empty() || raw == "auto" {
      return Self::default();
    }

    let mut pref = Self::default();
    for part in raw.split('|') {
      if let Some(lang) = part.strip_prefix("lang:") {
        if let Some(lang) = non_empty(Some(lang)) {
          pref.language = Some(lang.to_string());
        }
      } else if let Some(ch) = part.strip_prefix("channels:") {
        if let Ok(value) = ch.trim().parse::<u32>() {
          pref.channels = Some(value);
        }
      }
    }
    pref
  }
}

#[derive(Debug, Default)]
struct SelectorFilter {
  height: Option<u32>,
  fps: Option<u32>,
}

impl SelectorFilter {
  fn from_format_options(format_options: &FormatOptions) -> Self {
    Self {
      height: format_options.height,
      fps: format_options.fps,
    }
  }

  fn apply(&self, selector: &str) -> String {
    selector.to_string()
  }

  fn apply_height_and_fps(&self, selector: &str) -> String {
    let mut out = selector.to_string();
    if let Some(height) = self.height {
      out.push_str(&format!("[height<={height}]"));
    }
    if let Some(fps) = self.fps {
      out.push_str(&format!("[fps<={fps}]"));
    }
    out
  }

  fn apply_height(&self, selector: &str) -> String {
    let mut out = selector.to_string();
    if let Some(height) = self.height {
      out.push_str(&format!("[height<={height}]"));
    }
    out
  }

  fn apply_fps(&self, selector: &str) -> String {
    let mut out = selector.to_string();
    if let Some(fps) = self.fps {
      out.push_str(&format!("[fps<={fps}]"));
    }
    out
  }

  fn bounded_variants(&self, selector: &str) -> Vec<String> {
    let mut variants = Vec::new();

    if self.height.is_some() || self.fps.is_some() {
      variants.push(self.apply_height_and_fps(selector));
    }
    if self.height.is_some() && self.fps.is_some() {
      variants.push(self.apply_height(selector));
      variants.push(self.apply_fps(selector));
    }
    variants.push(selector.to_string());

    variants.dedup();
    variants
  }
}

#[derive(Debug, Default)]
struct FormatSort {
  fields: Vec<String>,
}

impl FormatSort {
  fn new() -> Self {
    Self::default()
  }

  fn prefer_language(&mut self, language: Option<&str>) {
    match language {
      Some(language) => self.push(format!("lang:{language}")),
      None => self.push("lang"),
    }
  }

  fn push(&mut self, field: impl Into<String>) {
    self.fields.push(field.into());
  }

  fn push_non_empty_prefixed(&mut self, prefix: &str, value: Option<&str>) {
    if let Some(value) = non_empty(value) {
      self.push(format!("{prefix}:{value}"));
    }
  }

  fn render(self) -> String {
    self.fields.join(",")
  }
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

fn non_empty(value: Option<&str>) -> Option<&str> {
  value.map(str::trim).filter(|value| !value.is_empty())
}
