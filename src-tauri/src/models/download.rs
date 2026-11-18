use crate::models::SubtitleInventory;
use crate::runners::template_context::TemplateContext;
use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::sync::LazyLock;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
  Both,
  Audio,
  Video,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoContainer {
  Mp4,
  Mkv,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoPostprocessPreset {
  None,
  Fps30,
  Mp42,
  Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoPostprocessMode {
  Remux,
  Reencode,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioPostprocessPreset {
  None,
  Custom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioFormat {
  Mp3,
  M4a,
  Opus,
  Aac,
  Ogg,
  Flac,
  Wav,
}

impl AudioFormat {
  pub fn supports_embedded_thumbnail(&self) -> bool {
    matches!(
      self,
      AudioFormat::Mp3
        | AudioFormat::M4a
        | AudioFormat::Opus
        | AudioFormat::Ogg
        | AudioFormat::Flac
    )
  }
  pub fn supports_audio_quality_selection(&self) -> bool {
    matches!(
      self,
      AudioFormat::Mp3 | AudioFormat::M4a | AudioFormat::Aac | AudioFormat::Ogg | AudioFormat::Opus
    )
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TranscodePolicy {
  Never,
  #[serde(alias = "remuxOnly")]
  AllowReencode,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
  pub id: String,
  pub url: String,
  pub format: FormatOptions,
  #[serde(default)]
  pub subtitle_inventory: Option<SubtitleInventory>,
  #[serde(default)]
  pub overrides: Option<DownloadOverrides>,
  pub template_context: TemplateContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatOptions {
  pub track_type: TrackType,
  pub abr: Option<u32>,
  pub height: Option<u32>,
  pub fps: Option<u32>,
  pub audio_encoding: Option<String>,
  pub video_encoding: Option<String>,
  pub audio_track: Option<String>,
  pub video_track: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOverrides {
  /// Title for a single item that has none of its own, such as a raw stream.
  pub title: Option<String>,
  pub output: Option<OutputOverrides>,
  pub auth: Option<AuthOverrides>,
  pub network: Option<NetworkOverrides>,
  pub subtitles: Option<SubtitleOverrides>,
  pub sponsor_block: Option<SponsorBlockOverrides>,
  pub input: Option<InputOverrides>,
  pub input_filters: Option<InputFilterOptions>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputOverrides {
  pub video: Option<VideoOutputOverrides>,
  pub audio: Option<AudioOutputOverrides>,
  pub add_metadata: Option<bool>,
  pub add_thumbnail: Option<bool>,
  pub save_thumbnail: Option<bool>,
  pub precise_cuts: Option<bool>,
  pub reverse_playlist_numbering: Option<bool>,
  pub file_name_template: Option<String>,
  pub audio_file_name_template: Option<String>,
  pub restrict_filenames: Option<bool>,
  pub partial_download: Option<PartialDownloadOverride>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartialDownloadOverride {
  pub section: Option<DownloadSection>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSection {
  pub id: String,
  pub start: String,
  pub end: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoOutputOverrides {
  pub container: Option<VideoContainer>,
  pub policy: Option<TranscodePolicy>,
  pub postprocess_preset: Option<VideoPostprocessPreset>,
  pub custom_postprocess_mode: Option<VideoPostprocessMode>,
  pub postprocess_args: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputOverrides {
  pub format: Option<AudioFormat>,
  pub policy: Option<TranscodePolicy>,
  pub postprocess_preset: Option<AudioPostprocessPreset>,
  pub postprocess_args: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthOverrides {
  pub cookie_file: Option<String>,
  pub cookie_browser: Option<String>,
  pub username: Option<String>,
  pub password: Option<String>,
  pub video_password: Option<String>,
  pub bearer_token: Option<String>,
  /// Replaces the headers from the app's settings.
  pub headers: Option<Vec<String>>,
  /// Sent in addition to the headers above.
  pub extra_headers: Option<Vec<String>>,
}

static URL_IN_TEXT: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r#"https?://[^\s'"<>]+"#).expect("invalid regex"));

/// An address without its sign-in (`user:pass@`) and without its query and fragment,
/// where access tokens are.
fn without_secrets(url: &str) -> Cow<'_, str> {
  let end = url.find(['?', '#']).unwrap_or(url.len());
  let bare = &url[..end];
  let host_from = bare.find("://").map_or(0, |at| at + 3);
  let host_to = bare[host_from..]
    .find('/')
    .map_or(bare.len(), |at| host_from + at);
  match bare[host_from..host_to].rfind('@') {
    Some(at) => Cow::Owned(format!(
      "{}{}",
      &bare[..host_from],
      &bare[host_from + at + 1..]
    )),
    None => Cow::Borrowed(bare),
  }
}

/// `%41` -> `A`, as yt-dlp does before it prints a name taken from an address.
fn percent_decoded(text: &str) -> String {
  let bytes = text.as_bytes();
  let mut out = Vec::with_capacity(bytes.len());
  let mut i = 0;
  while i < bytes.len() {
    let hex = bytes
      .get(i + 1..i + 3)
      .and_then(|h| std::str::from_utf8(h).ok());
    match hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
      Some(byte) if bytes[i] == b'%' => {
        out.push(byte);
        i += 3;
      }
      _ => {
        out.push(bytes[i]);
        i += 1;
      }
    }
  }
  String::from_utf8_lossy(&out).into_owned()
}

/// The name yt-dlp gives an address it has no extractor for, and prints in its messages:
/// whatever follows the last `/`, up to the last `.`. It takes the query for part of the
/// address, so a `/` or a `.` in the query puts a piece of it in the name.
fn generic_id(url: &str) -> &str {
  let tail = url.trim_end_matches('/').rsplit('/').next().unwrap_or("");
  match tail.rfind('.') {
    Some(dot) if dot > 0 => &tail[..dot],
    _ => tail,
  }
}

impl DownloadOverrides {
  /// Whether this item carries its own sign-in. Its address then often has an access
  /// token in it too, which must stay out of logs and error reports.
  fn is_signed_in(overrides: Option<&Self>) -> bool {
    overrides.is_some_and(|o| o.auth.is_some())
  }

  /// The address to write to logs and error reports.
  pub fn loggable_url<'a>(overrides: Option<&Self>, url: &'a str) -> Cow<'a, str> {
    if Self::is_signed_in(overrides) {
      without_secrets(url)
    } else {
      Cow::Borrowed(url)
    }
  }

  /// A line of yt-dlp output about the item at `url`, to keep or report. yt-dlp quotes
  /// addresses in its messages, and names the item after the end of its address.
  pub fn loggable_text<'a>(overrides: Option<&Self>, url: &str, text: &'a str) -> Cow<'a, str> {
    if !Self::is_signed_in(overrides) {
      return Cow::Borrowed(text);
    }
    let mut text = URL_IN_TEXT.replace_all(text, |found: &Captures| {
      without_secrets(&found[0]).into_owned()
    });
    let name = generic_id(url);
    let safe_name = generic_id(&without_secrets(url)).to_string();
    // Only a name that took something from the query needs replacing.
    if name != safe_name && name.len() >= 3 {
      for printed in [percent_decoded(name), name.to_string()] {
        if text.contains(&printed) {
          text = Cow::Owned(text.replace(&printed, &safe_name));
        }
      }
    }
    text
  }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkOverrides {
  pub enable_proxy: Option<bool>,
  pub proxy: Option<String>,
  pub impersonate: Option<String>,
  pub extractor_args: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleOverrides {
  pub enabled: Option<bool>,
  pub include_auto_generated: Option<bool>,
  pub languages: Option<Vec<String>>,
  pub manual_languages: Option<Vec<String>>,
  pub auto_languages: Option<Vec<String>>,
  pub format_preference: Option<Vec<String>>,
  pub embed_subtitles: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SponsorBlockOverrides {
  pub api_url: Option<String>,
  pub remove_parts: Option<Vec<String>>,
  pub mark_parts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputOverrides {
  pub prefer_video_in_mixed_links: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PlaylistMode {
  SingleVideo,
  #[default]
  Playlist,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputFilterOptions {
  pub playlist_items: Option<String>,
  pub min_filesize: Option<String>,
  pub max_filesize: Option<String>,
  pub date: Option<String>,
  pub datebefore: Option<String>,
  pub dateafter: Option<String>,
  pub match_filters: Option<String>,
  pub break_match_filters: Option<String>,
  pub playlist_mode: Option<PlaylistMode>,
}

#[cfg(test)]
mod tests {
  use super::{AuthOverrides, DownloadOverrides, TranscodePolicy};

  #[test]
  fn logs_leave_out_the_secrets_in_the_address_of_signed_in_items() {
    let url = "https://user:pass@cdn.test/master.m3u8?token=secret#t=1";
    let plain = DownloadOverrides::default();
    let signed_in = DownloadOverrides {
      auth: Some(AuthOverrides::default()),
      ..DownloadOverrides::default()
    };
    // An ordinary link is logged as it always was.
    assert_eq!(DownloadOverrides::loggable_url(None, url), url);
    assert_eq!(DownloadOverrides::loggable_url(Some(&plain), url), url);
    assert_eq!(
      DownloadOverrides::loggable_url(Some(&signed_in), url),
      "https://cdn.test/master.m3u8"
    );
    assert_eq!(
      DownloadOverrides::loggable_url(Some(&signed_in), "https://cdn.test/a@b/c?x=1"),
      "https://cdn.test/a@b/c"
    );

    // yt-dlp quotes the address in its messages.
    let page = "https://a.test/page?token=secret#frag";
    let line =
      "ERROR: Unsupported URL: https://a.test/page?token=secret#frag (see 'http://b.test/x?k=1')";
    assert_eq!(
      DownloadOverrides::loggable_text(Some(&plain), page, line),
      line
    );
    assert_eq!(
      DownloadOverrides::loggable_text(Some(&signed_in), page, line),
      "ERROR: Unsupported URL: https://a.test/page (see 'http://b.test/x')"
    );
    assert_eq!(
      DownloadOverrides::loggable_text(Some(&signed_in), page, "[download] 50% of 10MiB"),
      "[download] 50% of 10MiB"
    );
  }

  #[test]
  fn logs_leave_out_the_name_yt_dlp_takes_from_the_query() {
    let signed_in = DownloadOverrides {
      auth: Some(AuthOverrides::default()),
      ..DownloadOverrides::default()
    };
    let text = |url: &str, line: &str| {
      DownloadOverrides::loggable_text(Some(&signed_in), url, line).into_owned()
    };

    // A `/` in the query: yt-dlp names the item after what follows it.
    let akamai = "https://cdn.test/hls/master.m3u8?hdnts=exp=1~acl=/*~hmac=SECRETHMAC";
    assert_eq!(
      text(akamai, "[generic] *~hmac=SECRETHMAC: Downloading webpage"),
      "[generic] master: Downloading webpage"
    );
    // A `.` after the token: the name runs up to it.
    let dotted = "https://cdn.test/hls/master.m3u8?token=SECRETTOKEN&e=17.5";
    assert_eq!(
      text(
        dotted,
        "ERROR: [generic] master.m3u8?token=SECRETTOKEN&e=17: Unable to download webpage"
      ),
      "ERROR: [generic] master: Unable to download webpage"
    );
    // Printed percent-decoded.
    let encoded = "https://cdn.test/v.m3u8?sig=SECRET%2Fabc%20def.x";
    assert_eq!(
      text(
        encoded,
        "[generic] v.m3u8?sig=SECRET/abc def: Downloading webpage"
      ),
      "[generic] v: Downloading webpage"
    );
    // A name that has nothing of the query in it is left alone, wherever else it appears.
    let plain = "https://cdn.test/hls/master.m3u8?token=SECRETTOKEN";
    assert_eq!(
      text(plain, "[generic] master: Downloading m3u8 master manifest"),
      "[generic] master: Downloading m3u8 master manifest"
    );
  }

  #[test]
  fn transcode_policy_deserializes_legacy_remux_only_as_allow_reencode() {
    let policy: TranscodePolicy = serde_json::from_str(r#""remuxOnly""#).unwrap();
    assert!(matches!(policy, TranscodePolicy::AllowReencode));
  }
}
