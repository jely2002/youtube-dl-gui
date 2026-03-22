use crate::models::download::{
  AudioOutputOverrides, AuthOverrides, InputOverrides, NetworkOverrides, OutputOverrides,
  SponsorBlockOverrides, SubtitleOverrides, VideoOutputOverrides,
};
use crate::state::config_models::{
  AudioOutputSettings, AuthSettings, InputSettings, NetworkSettings, OutputSettings,
  SponsorBlockSettings, SubtitleSettings, VideoOutputSettings,
};
use crate::stronghold::stronghold_state::AuthSecrets;

macro_rules! apply_nested_patch {
  ($patch:expr, $target:expr, $field:ident) => {
    if let Some(value) = $patch.$field.as_ref() {
      value.apply_to(&mut $target.$field);
    }
  };
}

macro_rules! apply_copy_patch {
  ($patch:expr, $target:expr, $field:ident) => {
    if let Some(value) = $patch.$field {
      $target.$field = value;
    }
  };
}

macro_rules! apply_clone_patch {
  ($patch:expr, $target:expr, $field:ident) => {
    if let Some(value) = $patch.$field.as_ref() {
      $target.$field = value.clone();
    }
  };
}

pub trait ApplyPatch<T> {
  fn apply_to(&self, target: &mut T);
}

pub fn resolve_with_patch<T, P>(base: &T, patch: Option<&P>) -> T
where
  T: Clone,
  P: ApplyPatch<T>,
{
  let mut resolved = base.clone();
  if let Some(patch) = patch {
    patch.apply_to(&mut resolved);
  }
  resolved
}

impl ApplyPatch<VideoOutputSettings> for VideoOutputOverrides {
  fn apply_to(&self, target: &mut VideoOutputSettings) {
    apply_copy_patch!(self, target, container);
    apply_copy_patch!(self, target, policy);
  }
}

impl ApplyPatch<AudioOutputSettings> for AudioOutputOverrides {
  fn apply_to(&self, target: &mut AudioOutputSettings) {
    apply_copy_patch!(self, target, format);
    apply_copy_patch!(self, target, policy);
  }
}

impl ApplyPatch<OutputSettings> for OutputOverrides {
  fn apply_to(&self, target: &mut OutputSettings) {
    apply_nested_patch!(self, target, video);
    apply_nested_patch!(self, target, audio);
    apply_copy_patch!(self, target, add_metadata);
    apply_copy_patch!(self, target, add_thumbnail);
    apply_clone_patch!(self, target, file_name_template);
    apply_clone_patch!(self, target, audio_file_name_template);
    apply_copy_patch!(self, target, restrict_filenames);
  }
}

impl ApplyPatch<NetworkSettings> for NetworkOverrides {
  fn apply_to(&self, target: &mut NetworkSettings) {
    if let Some(enable_proxy) = self.enable_proxy {
      target.enable_proxy = Some(enable_proxy);
    }
    if let Some(proxy) = self.proxy.as_ref() {
      target.proxy = Some(proxy.clone());
    }
    apply_clone_patch!(self, target, impersonate);
  }
}

impl ApplyPatch<SubtitleSettings> for SubtitleOverrides {
  fn apply_to(&self, target: &mut SubtitleSettings) {
    apply_copy_patch!(self, target, enabled);
    apply_copy_patch!(self, target, include_auto_generated);
    apply_clone_patch!(self, target, languages);
    apply_clone_patch!(self, target, format_preference);
    apply_copy_patch!(self, target, embed_subtitles);
  }
}

impl ApplyPatch<SponsorBlockSettings> for SponsorBlockOverrides {
  fn apply_to(&self, target: &mut SponsorBlockSettings) {
    if let Some(api_url) = self.api_url.as_ref() {
      target.api_url = Some(api_url.clone());
    }
    apply_clone_patch!(self, target, remove_parts);
    apply_clone_patch!(self, target, mark_parts);
  }
}

impl ApplyPatch<InputSettings> for InputOverrides {
  fn apply_to(&self, target: &mut InputSettings) {
    apply_copy_patch!(self, target, prefer_video_in_mixed_links);
  }
}

impl ApplyPatch<AuthSettings> for AuthOverrides {
  fn apply_to(&self, target: &mut AuthSettings) {
    if let Some(cookie_file) = self.cookie_file.as_ref() {
      target.cookie_file = Some(cookie_file.clone());
    }
    apply_clone_patch!(self, target, cookie_browser);
  }
}

impl ApplyPatch<AuthSecrets> for AuthOverrides {
  fn apply_to(&self, target: &mut AuthSecrets) {
    if let Some(username) = self.username.as_ref() {
      target.username = Some(username.clone());
    }
    if let Some(password) = self.password.as_ref() {
      target.password = Some(password.clone());
    }
    if let Some(video_password) = self.video_password.as_ref() {
      target.video_password = Some(video_password.clone());
    }
    if let Some(bearer_token) = self.bearer_token.as_ref() {
      target.bearer_token = Some(bearer_token.clone());
    }
    apply_clone_patch!(self, target, headers);
  }
}

#[cfg(test)]
mod tests {
  use super::resolve_with_patch;
  use crate::models::download::{
    AuthOverrides, OutputOverrides, SubtitleOverrides, VideoOutputOverrides,
  };
  use crate::models::download::{TranscodePolicy, VideoContainer};
  use crate::state::config_models::{AuthSettings, OutputSettings, SubtitleSettings};
  use crate::stronghold::stronghold_state::AuthSecrets;

  #[test]
  fn resolve_output_applies_partial_nested_patch() {
    let base = OutputSettings::default();
    let patch = OutputOverrides {
      video: Some(VideoOutputOverrides {
        container: Some(VideoContainer::Mkv),
        policy: Some(TranscodePolicy::Never),
      }),
      add_thumbnail: Some(false),
      ..Default::default()
    };

    let resolved = resolve_with_patch(&base, Some(&patch));
    assert!(matches!(resolved.video.container, VideoContainer::Mkv));
    assert!(matches!(resolved.video.policy, TranscodePolicy::Never));
    assert!(!resolved.add_thumbnail);
    assert_eq!(resolved.add_metadata, base.add_metadata);
  }

  #[test]
  fn resolve_output_without_patch_is_identity() {
    let base = OutputSettings::default();
    let resolved: OutputSettings =
      resolve_with_patch::<OutputSettings, OutputOverrides>(&base, None);
    assert_eq!(resolved.add_metadata, base.add_metadata);
    assert_eq!(resolved.add_thumbnail, base.add_thumbnail);
    assert!(matches!(resolved.video.container, VideoContainer::Mp4));
  }

  #[test]
  fn resolve_subtitles_replaces_lists() {
    let base = SubtitleSettings::default();
    let patch = SubtitleOverrides {
      languages: Some(vec!["ja".into(), "en".into()]),
      format_preference: Some(vec!["vtt".into()]),
      ..Default::default()
    };

    let resolved = resolve_with_patch(&base, Some(&patch));
    assert_eq!(resolved.languages, vec!["ja".to_string(), "en".to_string()]);
    assert_eq!(resolved.format_preference, vec!["vtt".to_string()]);
  }

  #[test]
  fn resolve_auth_settings_and_secrets() {
    let base_settings = AuthSettings {
      cookie_file: Some("/tmp/default-cookies.txt".into()),
      cookie_browser: "none".into(),
    };
    let base_secrets = AuthSecrets {
      username: Some("u0".into()),
      password: Some("p0".into()),
      video_password: None,
      bearer_token: None,
      headers: vec!["X-A: 1".into()],
    };
    let patch = AuthOverrides {
      cookie_browser: Some("firefox".into()),
      username: Some("u1".into()),
      headers: Some(vec!["X-B: 2".into()]),
      ..Default::default()
    };

    let resolved_settings = resolve_with_patch(&base_settings, Some(&patch));
    let resolved_secrets = resolve_with_patch(&base_secrets, Some(&patch));

    assert_eq!(resolved_settings.cookie_browser, "firefox");
    assert_eq!(
      resolved_settings.cookie_file,
      Some("/tmp/default-cookies.txt".into())
    );
    assert_eq!(resolved_secrets.username, Some("u1".into()));
    assert_eq!(resolved_secrets.password, Some("p0".into()));
    assert_eq!(resolved_secrets.headers, vec!["X-B: 2".to_string()]);
  }
}
