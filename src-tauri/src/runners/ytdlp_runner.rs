use crate::models::download::FormatOptions;
use crate::paths::PathsManager;
use crate::runners::ytdlp_args::{build_format_args, build_output_args};
use crate::state::config_models::{Config, SubtitleSettings};
use crate::stronghold::stronghold_state::{AuthSecrets, StrongholdState};
use crate::SharedConfig;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::async_runtime::Receiver;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, Output};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

pub struct YtdlpRunner<'a> {
  app: &'a AppHandle,
  cfg: Arc<Config>,
  args: Vec<String>,
  bin_dir: PathBuf,
}

impl<'a> YtdlpRunner<'a> {
  pub fn new(app: &'a AppHandle) -> Self {
    let paths_manager = app.state::<PathsManager>();
    let bin_dir = paths_manager.bin_dir().clone();
    let args = vec!["--encoding".into(), "utf-8".into()];
    let cfg_handle = app.state::<SharedConfig>();
    let cfg = cfg_handle.load();

    Self {
      app,
      cfg,
      args,
      bin_dir,
    }
  }

  pub fn with_args<I, S>(mut self, args: I) -> Self
  where
    I: IntoIterator<Item = S>,
    S: Into<String>,
  {
    self.args.extend(args.into_iter().map(Into::into));
    self
  }

  pub fn with_network_args(mut self) -> Self {
    if let Some(ref proxy) = self.cfg.network.proxy {
      self.args.push("--proxy".to_string());
      self.args.push(proxy.clone());
    }

    match self.cfg.network.impersonate.as_str() {
      "none" => {}
      "any" => {
        self.args.push("--impersonate".to_string());
        self.args.push(String::new());
      }
      other => {
        self.args.push("--impersonate".to_string());
        self.args.push(other.to_string());
      }
    }

    self
  }

  pub fn with_auth_args(mut self) -> Self {
    if self.cfg.auth.cookie_browser != "none" {
      self.args.extend_from_slice(&[
        "--cookies-from-browser".into(),
        self.cfg.auth.cookie_browser.clone(),
      ]);
    }
    if self.cfg.auth.cookie_file.is_some() {
      self.args.extend_from_slice(&[
        "--cookies".into(),
        self.cfg.auth.cookie_file.clone().unwrap(),
      ]);
    }

    if let Some(sh_state) = self.app.try_state::<StrongholdState>() {
      if let Ok(secrets) = sh_state.load_auth_secrets() {
        self.apply_auth_secrets(secrets);
      }
    }

    self
  }

  pub fn with_subtitle_args(mut self) -> Self {
    if let Some(subtitle_args) = build_subtitle_args(&self.cfg.subtitles) {
      self.args.extend(subtitle_args);
    }

    self
  }

  pub fn with_sponsorblock_args(mut self) -> Self {
    if let Some(api_url) = &self.cfg.sponsor_block.api_url {
      self
        .args
        .extend_from_slice(&["--sponsorblock-api".into(), api_url.clone()]);
    }

    if !self.cfg.sponsor_block.remove_parts.is_empty() {
      self.args.extend_from_slice(&[
        "--sponsorblock-remove".into(),
        self.cfg.sponsor_block.remove_parts.join(","),
      ]);
    }

    if !self.cfg.sponsor_block.mark_parts.is_empty() {
      self.args.extend_from_slice(&[
        "--sponsorblock-mark".into(),
        self.cfg.sponsor_block.mark_parts.join(","),
      ]);
    }

    self
  }

  pub fn with_progress_args(mut self) -> Self {
    self.args.extend_from_slice(&[
            "--newline".into(),
            "--progress".into(),
            "--no-color".into(),
            "--progress-template".into(),
            "RAW|%(progress.percent|)s|%(progress._percent_str|)s|%(progress.speed|)s|%(progress.eta|)s|%(progress.downloaded_bytes|)s|%(progress.total_bytes|)s|%(progress.total_bytes_estimate|)s|%(progress.fragment_index|)s|%(progress.fragment_count|)s".into(),
            "--progress-delta".into(),
            "0.5".into(),
        ]);
    self
  }

  pub fn with_format_args(mut self, format_options: &FormatOptions) -> Self {
    self
      .args
      .extend(build_format_args(format_options, &self.cfg.output.clone()));
    self
  }

  pub fn with_input_args(mut self) -> Self {
    if self.cfg.input.prefer_video_in_mixed_links {
      self.args.push("--no-playlist".into());
    } else {
      self.args.push("--yes-playlist".into());
    }
    self
  }

  pub fn with_output_args(mut self, format_options: &FormatOptions) -> Self {
    self
      .args
      .extend(build_output_args(format_options, &self.cfg.output));
    self
  }

  pub async fn shell(self) -> Result<Output, String> {
    tracing::info!("Running command: yt-dlp {}", self.args.join(" "));
    let separator = if cfg!(windows) { ';' } else { ':' };
    let path_env = std::env::var("PATH").unwrap_or_default();
    let new_path = format!("{}{}{}", self.bin_dir.display(), separator, path_env);
    self
      .app
      .shell()
      .command("yt-dlp")
      .args(self.args)
      .env("PATH", new_path)
      .output()
      .await
      .map_err(|e| format!("yt-dlp failed to run: {e}"))
  }

  pub fn spawn(self) -> Result<(Receiver<CommandEvent>, CommandChild), String> {
    tracing::info!("Running command: yt-dlp {}", self.args.join(" "));
    let separator = if cfg!(windows) { ';' } else { ':' };
    let path_env = std::env::var("PATH").unwrap_or_default();
    let new_path = format!("{}{}{}", self.bin_dir.display(), separator, path_env);
    self
      .app
      .shell()
      .command("yt-dlp")
      .args(self.args)
      .env("PATH", new_path)
      .spawn()
      .map_err(|e| format!("yt-dlp failed to spawn: {e}"))
  }

  fn apply_auth_secrets(&mut self, s: AuthSecrets) {
    if let Some(u) = s.username {
      self.args.push("--username".into());
      self.args.push(u);
    }
    if let Some(p) = s.password {
      self.args.push("--password".into());
      self.args.push(p);
    }
    if let Some(vp) = s.video_password {
      self.args.push("--video-password".into());
      self.args.push(vp);
    }
    if let Some(token) = s.bearer_token {
      self.args.push("--add-header".into());
      self.args.push(format!("Authorization:Bearer {token}"));
    }
    for h in s.headers {
      self.args.push("--add-header".into());
      self.args.push(h);
    }
  }
}

fn build_subtitle_args(settings: &SubtitleSettings) -> Option<Vec<String>> {
  if !settings.enabled {
    return None;
  }

  let mut args = vec!["--write-subs".into()];

  if settings.embed_subtitles {
    args.push("--embed-subs".into());
    // Remove the subtitle file after embedding it.
    args.push("--no-write-auto-subs".into());
    args.push("--no-write-subs".into());
  } else {
    args.push("--no-embed-subs".into());
  }

  if settings.include_auto_generated {
    args.push("--write-auto-subs".into());
  }

  let formats = sanitize_subtitle_formats(&settings.format_preference);
  args.push("--sub-format".into());
  args.push(formats.join("/"));

  let languages = sanitize_subtitle_languages(&settings.languages);
  args.push("--sub-langs".into());
  args.push(languages.join(","));

  Some(args)
}

fn sanitize_subtitle_formats(formats: &[String]) -> Vec<String> {
  const DEFAULT_FORMATS: [&str; 5] = ["srt", "vtt", "ass", "ttml", "json"];

  let normalized_inputs = sanitize_vec(formats);

  let primary = normalized_inputs
    .iter()
    .find(|value| DEFAULT_FORMATS.contains(&value.as_str()))
    .cloned()
    .unwrap_or_else(|| {
      normalized_inputs
        .first()
        .cloned()
        .unwrap_or_else(|| DEFAULT_FORMATS[0].to_string())
    });

  let mut ordered = Vec::new();
  let mut seen = HashSet::new();

  if seen.insert(primary.clone()) {
    ordered.push(primary);
  }

  for fallback in &DEFAULT_FORMATS {
    let normalized = (*fallback).to_string();
    if seen.insert(normalized.clone()) {
      ordered.push(normalized);
    }
  }

  for extra in normalized_inputs {
    if seen.insert(extra.clone()) {
      ordered.push(extra);
    }
  }

  ordered
}

fn sanitize_subtitle_languages(languages: &[String]) -> Vec<String> {
  if languages
    .iter()
    .any(|language| language.trim().eq_ignore_ascii_case("all"))
  {
    return vec!["all".into()];
  }

  let mut sanitized = sanitize_vec(languages);

  if sanitized.is_empty() {
    sanitized.push("en".into());
  }

  sanitized
}

fn sanitize_vec(items: &[String]) -> Vec<String> {
  let mut seen = HashSet::new();
  let mut sanitized = Vec::new();

  for item in items {
    let trimmed = item.trim();
    if trimmed.is_empty() {
      continue;
    }

    let key = trimmed.to_ascii_lowercase();
    if seen.insert(key.clone()) {
      sanitized.push(key);
    }
  }

  sanitized
}

#[cfg(test)]
mod tests {
  use super::build_subtitle_args;
  use crate::state::config_models::SubtitleSettings;

  #[test]
  fn subtitles_disabled_returns_none() {
    let settings = SubtitleSettings::default();
    assert!(build_subtitle_args(&settings).is_none());
  }

  #[test]
  fn subtitles_enabled_uses_defaults_when_empty() {
    let mut settings = SubtitleSettings {
      enabled: true,
      ..Default::default()
    };
    settings.languages.clear();
    settings.format_preference.clear();

    let args = build_subtitle_args(&settings).expect("args");
    assert_eq!(
      args,
      vec![
        "--write-subs",
        "--embed-subs",
        "--no-write-auto-subs",
        "--no-write-subs",
        "--sub-format",
        "srt/vtt/ass/ttml/json",
        "--sub-langs",
        "en"
      ]
    );
  }

  #[test]
  fn subtitles_embed_and_include_auto_generated_enabled() {
    let settings = SubtitleSettings {
      enabled: true,
      embed_subtitles: true,
      include_auto_generated: true,
      ..Default::default()
    };
    let args = build_subtitle_args(&settings).expect("args");
    assert_eq!(
      args,
      vec![
        "--write-subs",
        "--embed-subs",
        "--no-write-auto-subs",
        "--no-write-subs",
        "--write-auto-subs",
        "--sub-format",
        "srt/vtt/ass/ttml/json",
        "--sub-langs",
        "en"
      ]
    );
  }

  #[test]
  fn subtitles_enabled_honors_all_language() {
    let settings = SubtitleSettings {
      enabled: true,
      languages: vec!["all".into(), "en".into()],
      format_preference: vec!["srt".into(), "vtt".into()],
      embed_subtitles: false,
      include_auto_generated: true,
    };

    let args = build_subtitle_args(&settings).expect("args");
    assert_eq!(
      args,
      vec![
        "--write-subs",
        "--no-embed-subs",
        "--write-auto-subs",
        "--sub-format",
        "srt/vtt/ass/ttml/json",
        "--sub-langs",
        "all"
      ]
    );
  }

  #[test]
  fn subtitles_trim_and_dedupe_values() {
    let settings = SubtitleSettings {
      enabled: true,
      languages: vec![" en ".into(), "EN".into(), String::new()],
      format_preference: vec![" srt ".into(), "SRT".into(), String::new()],
      ..Default::default()
    };
    let args = build_subtitle_args(&settings).expect("args");
    assert_eq!(args[5], "srt/vtt/ass/ttml/json");
    assert_eq!(args[7], "en");
  }
}
