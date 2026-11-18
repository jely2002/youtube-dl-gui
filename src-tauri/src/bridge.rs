//! Localhost bridge for the companion browser extension (`extension/`).
//!
//! The extension posts a media URL with the cookies and request headers the browser
//! used for it; we queue it like a pasted link. Anything on this computer can reach a
//! local port, so both sides prove themselves with a key the user hands over once:
//!
//! - `POST /pair`   asks the user (in a dialog) to copy the key to the clipboard.
//! - `POST /hello`  `{nonce}` -> `{proof, nonce}`. The proof shows the extension that
//!   it is talking to the app that holds the key, before it sends any cookies.
//! - `POST /add`    the link, signed with the key and the nonce `/hello` returned.

use crate::i18n::I18nManager;
use crate::paths::PathsManager;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Semaphore;

// Keep in sync with extension/send.js.
const BRIDGE_ADDR: &str = "127.0.0.1:46123";
/// The extension's origin. Its ID is fixed by the `key` in extension/manifest.json;
/// a Chrome Web Store release gets a different ID, which must be added here.
const EXTENSION_ORIGIN: &str = "chrome-extension://gdfpdddiobeogmkjlagehfngamgojefj";
const MAX_REQUEST: usize = 1 << 20;
const MAX_HEAD: usize = 16 << 10;
const MAX_CONNECTIONS: usize = 16;
const MAX_URL_BYTES: usize = 8 << 10;
const MAX_HEADERS: usize = 64;
// Headers become command-line arguments, which Windows limits to about 32 KiB in all.
const MAX_HEADER_BYTES: usize = 16 << 10;
const MAX_TITLE_CHARS: usize = 150;
const MAX_TITLE_BYTES: usize = 200;
const MAX_COOKIE_FILES: usize = 200;
const MAX_SPENT_NONCES: usize = 1024;
const NONCE_LIFETIME: Duration = Duration::from_secs(60);
const KEY_LEN: usize = 64;
/// How long after a pairing question was answered the next one may be asked.
const PAIR_AGAIN_AFTER_ALLOW: Duration = Duration::from_secs(10);
const PAIR_AGAIN_AFTER_REFUSAL: Duration = Duration::from_secs(60);

static STARTED: AtomicBool = AtomicBool::new(false);
/// Counts the times the key was copied to the clipboard.
static COPIES: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Deserialize)]
struct AddRequest {
  url: String,
  #[serde(default)]
  headers: Vec<String>,
  /// Netscape cookie file contents.
  #[serde(default)]
  cookies: String,
  /// Start downloading right away instead of only queueing.
  #[serde(default)]
  download: bool,
  /// Name for a raw stream, which carries no title of its own.
  #[serde(default)]
  title: Option<String>,
}

#[derive(Deserialize)]
struct HelloRequest {
  nonce: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeAddPayload {
  url: String,
  cookie_file: Option<String>,
  headers: Vec<String>,
  download: bool,
  title: Option<String>,
}

struct Bridge {
  /// Handed to the extension when the user pairs it. Proves each side to the other.
  key: String,
  /// Challenges from `/hello` that an `/add` has used, with when they were issued.
  /// Each is good for one request.
  spent: Mutex<VecDeque<(String, u64)>>,
  /// Whether the pairing dialog is open.
  pairing: AtomicBool,
  /// When the next pairing question may be asked.
  pair_again: Mutex<Instant>,
  /// Which copy of the key may still be on the clipboard from pairing: 0 for none,
  /// otherwise a number that goes up with each pairing.
  key_on_clipboard: AtomicU64,
}

#[derive(Debug)]
enum Action {
  Pair,
  Add(AddRequest),
}

#[derive(Debug)]
struct Reply {
  status: &'static str,
  body: Option<String>,
  action: Option<Action>,
}

impl Reply {
  fn status(status: &'static str) -> Self {
    Self {
      status,
      body: None,
      action: None,
    }
  }
}

/// Starts listening. Call once the frontend can receive events; later calls do nothing.
pub fn start(app: &AppHandle) {
  if STARTED.swap(true, Ordering::SeqCst) {
    return;
  }
  // Cookie files from an earlier run that did not exit cleanly hold session secrets.
  remove_cookie_files(app);

  let key = match load_or_create_key(&key_path(app)) {
    Ok(key) => key,
    Err(e) => {
      tracing::warn!(error = %e, "Browser extension bridge disabled: no connection key");
      return;
    }
  };
  let bridge = Arc::new(Bridge::new(key));

  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    let listener = match TcpListener::bind(BRIDGE_ADDR).await {
      Ok(listener) => listener,
      Err(e) => {
        tracing::warn!(error = %e, "Browser extension bridge disabled: could not bind");
        return;
      }
    };
    let permits = Arc::new(Semaphore::new(MAX_CONNECTIONS));

    loop {
      let Ok((stream, _)) = listener.accept().await else {
        // Typically out of file descriptors: wait rather than spin.
        tokio::time::sleep(Duration::from_millis(100)).await;
        continue;
      };
      // Busy: drop the connection. The extension reports that the app could not be reached.
      let Ok(permit) = permits.clone().try_acquire_owned() else {
        continue;
      };
      let (app, bridge) = (app.clone(), bridge.clone());
      tauri::async_runtime::spawn(async move {
        let _ = tokio::time::timeout(Duration::from_secs(5), handle(stream, &app, bridge)).await;
        drop(permit);
      });
    }
  });
}

/// Deletes the cookies received from the browser. Call on exit.
pub fn remove_cookie_files(app: &AppHandle) {
  let _ = std::fs::remove_dir_all(cookie_dir(app));
}

/// In the user's own data folder even for a portable install, whose folder may be shared.
fn key_path(app: &AppHandle) -> PathBuf {
  app
    .path()
    .app_local_data_dir()
    .unwrap_or_else(|_| app.state::<PathsManager>().app_dir().clone())
    .join("bridge-key")
}

/// The user's own cache folder, which other users of the computer cannot read.
fn cookie_dir(app: &AppHandle) -> PathBuf {
  app
    .path()
    .app_cache_dir()
    .unwrap_or_else(|_| app.state::<PathsManager>().app_dir().clone())
    .join("bridge-cookies")
}

async fn handle(mut stream: TcpStream, app: &AppHandle, bridge: Arc<Bridge>) {
  let mut reply = match read_request(&mut stream).await {
    Ok(raw) => bridge.route(&raw),
    Err(status) => Reply::status(status),
  };
  match reply.action.take() {
    Some(Action::Pair) => ask_to_pair(app, bridge),
    Some(Action::Add(req)) => {
      // A signed link means the key has been pasted: it need not stay on the clipboard.
      clear_key_from_clipboard(app, &bridge);
      if let Err(e) = accept(app, req) {
        tracing::warn!(error = %e, "Bridge could not store cookies");
        reply = Reply::status("500 Internal Server Error");
      }
    }
    None => {}
  }
  let body = reply.body.unwrap_or_default();
  let response = format!(
    "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    reply.status,
    body.len()
  );
  let _ = stream.write_all(response.as_bytes()).await;
}

/// Shows the pairing dialog. On "Allow" the key goes to the clipboard for the user to
/// paste into the extension. The clipboard belongs to this user's session, so another
/// user of the computer cannot read it; programs this user runs (a clipboard manager,
/// say) can.
fn ask_to_pair(app: &AppHandle, bridge: Arc<Bridge>) {
  let i18n = app.state::<I18nManager>();
  let buttons =
    MessageDialogButtons::OkCancelCustom(i18n.t("bridge.pair.allow"), i18n.t("bridge.pair.deny"));
  let handle = app.clone();
  // The request came from the browser; bring the app forward so the question is seen.
  crate::reopen_window(app);
  app
    .dialog()
    .message(i18n.t("bridge.pair.message"))
    .title(i18n.t("bridge.pair.title"))
    .buttons(buttons)
    .show(move |allowed| {
      let wait = if allowed {
        PAIR_AGAIN_AFTER_ALLOW
      } else {
        PAIR_AGAIN_AFTER_REFUSAL
      };
      *bridge.pair_again.lock().unwrap() = Instant::now() + wait;
      bridge.pairing.store(false, Ordering::SeqCst);
      if !allowed {
        return;
      }
      if let Err(e) = handle.clipboard().write_text(bridge.key.clone()) {
        tracing::warn!(error = %e, "Could not copy the connection key");
        return;
      }
      let copy = COPIES.fetch_add(1, Ordering::SeqCst) + 1;
      bridge.key_on_clipboard.store(copy, Ordering::SeqCst);
      // Do not leave the key on the clipboard once it has had time to be pasted. A later
      // pairing has its own ninety seconds; this timer only clears its own copy.
      tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(90)).await;
        let still_ours = bridge
          .key_on_clipboard
          .compare_exchange(copy, 0, Ordering::SeqCst, Ordering::SeqCst)
          .is_ok();
        if still_ours {
          clear_clipboard_if_key(&handle, &bridge.key);
        }
      });
    });
}

/// Empties the clipboard if a copy of the key from pairing may still be on it.
fn clear_key_from_clipboard(app: &AppHandle, bridge: &Bridge) {
  if bridge.key_on_clipboard.swap(0, Ordering::SeqCst) != 0 {
    clear_clipboard_if_key(app, &bridge.key);
  }
}

fn clear_clipboard_if_key(app: &AppHandle, key: &str) {
  let clipboard = app.clipboard();
  if clipboard.read_text().is_ok_and(|text| text == key) {
    let _ = clipboard.clear();
  }
}

fn accept(app: &AppHandle, req: AddRequest) -> std::io::Result<()> {
  let cookie_file = if req.cookies.trim().is_empty() {
    None
  } else {
    Some(write_cookie_file(&cookie_dir(app), &req.cookies)?)
  };
  // A queued link needs the user to pick a format, and a page may turn out to be a
  // playlist that needs a choice. A stream sent to download needs nothing: stay put.
  let needs_the_user = !req.download || req.title.is_none();
  let _ = app.emit(
    "bridge_media_add",
    BridgeAddPayload {
      url: req.url,
      cookie_file,
      headers: req.headers,
      download: req.download,
      title: clean_title(req.title),
    },
  );
  if needs_the_user {
    crate::reopen_window(app);
  }
  Ok(())
}

impl Bridge {
  fn new(key: String) -> Self {
    Self {
      key,
      spent: Mutex::new(VecDeque::new()),
      pairing: AtomicBool::new(false),
      pair_again: Mutex::new(Instant::now()),
      key_on_clipboard: AtomicU64::new(0),
    }
  }

  /// Decides what a request gets, without doing anything yet.
  ///
  /// Every request must name our extension as its `Origin` and carry JSON. A web page
  /// can do neither: the browser sets `Origin` itself, and asks our permission before
  /// sending JSON across origins (a CORS preflight), which we never grant. That keeps
  /// web pages out. It does not keep out another extension that rewrites its own
  /// headers, or another program on this computer, which can send any header it likes.
  /// The key does: without it nothing gets past `/hello` and `/pair`.
  fn route(&self, raw: &[u8]) -> Reply {
    const BAD: &str = "400 Bad Request";
    let Some(head_end) = find_head_end(raw) else {
      return Reply::status(BAD);
    };
    let Ok(head) = std::str::from_utf8(&raw[..head_end]) else {
      return Reply::status(BAD);
    };
    let body = &raw[head_end + 4..];
    let mut request_line = head.lines().next().unwrap_or_default().split(' ');
    let (method, path) = (request_line.next(), request_line.next());
    if method != Some("POST") || !matches!(path, Some("/pair" | "/hello" | "/add")) {
      return Reply::status("404 Not Found");
    }
    if header(head, "origin") != Some(EXTENSION_ORIGIN) {
      return Reply::status("403 Forbidden");
    }
    let is_json = header(head, "content-type")
      .is_some_and(|c| c.to_ascii_lowercase().starts_with("application/json"));
    if !is_json {
      return Reply::status("415 Unsupported Media Type");
    }

    match path {
      Some("/pair") => {
        // One question at a time, and not again right after an answer, however often
        // it is asked: anything that can send our Origin can ask.
        let too_soon = Instant::now() < *self.pair_again.lock().unwrap();
        if too_soon || self.pairing.swap(true, Ordering::SeqCst) {
          return Reply::status("429 Too Many Requests");
        }
        Reply {
          status: "202 Accepted",
          body: None,
          action: Some(Action::Pair),
        }
      }
      Some("/hello") => match serde_json::from_slice::<HelloRequest>(body) {
        Ok(hello) if is_token(&hello.nonce) => Reply {
          status: "200 OK",
          body: Some(
            serde_json::json!({
              "proof": hmac_hex(&self.key, &[b"app:", hello.nonce.as_bytes()]),
              "nonce": self.issue_nonce(),
            })
            .to_string(),
          ),
          action: None,
        },
        _ => Reply::status(BAD),
      },
      _ => {
        let nonce = header(head, "x-ovd-nonce").unwrap_or_default();
        let proof = header(head, "x-ovd-proof").unwrap_or_default();
        let expected = hmac_hex(&self.key, &[b"ext:", nonce.as_bytes(), b":", body]);
        let signed = constant_time_eq(proof.as_bytes(), expected.as_bytes());
        // Only a request that proves the key uses up its challenge, so nobody without
        // the key can use up someone else's.
        let now = now_ms();
        if !self.is_live_nonce(nonce, now) || !signed || !self.spend_nonce(nonce, now) {
          return Reply::status("401 Unauthorized");
        }
        match parse_add(body) {
          Some(req) => Reply {
            status: "200 OK",
            body: None,
            action: Some(Action::Add(req)),
          },
          None => Reply::status(BAD),
        }
      }
    }
  }

  /// A challenge is a timestamp and a random part, sealed with the key. Nothing is kept
  /// until it is used, so asking for challenges cannot crowd out anyone else's.
  fn issue_nonce(&self) -> String {
    self.nonce_at(now_ms())
  }

  fn nonce_at(&self, issued_ms: u64) -> String {
    let stamp = format!("{issued_ms:016x}");
    let random = uuid::Uuid::new_v4().simple().to_string();
    let seal = hmac_hex(&self.key, &[b"nonce:", stamp.as_bytes(), random.as_bytes()]);
    format!("{stamp}{random}{seal}")
  }

  /// Whether we issued this challenge and it has not expired.
  fn is_live_nonce(&self, nonce: &str, now_ms: u64) -> bool {
    if nonce.len() != 16 + 32 + 64 || !nonce.is_ascii() {
      return false;
    }
    let (body, seal) = nonce.split_at(16 + 32);
    let expected = hmac_hex(&self.key, &[b"nonce:", body.as_bytes()]);
    let Ok(issued_ms) = u64::from_str_radix(&body[..16], 16) else {
      return false;
    };
    let lifetime = NONCE_LIFETIME.as_millis() as u64;
    constant_time_eq(seal.as_bytes(), expected.as_bytes())
      && issued_ms <= now_ms
      && now_ms - issued_ms <= lifetime
  }

  /// Marks a live challenge as used. False if it was used before.
  fn spend_nonce(&self, nonce: &str, now_ms: u64) -> bool {
    // Remembered for twice as long as a challenge lives, so that one used in its last
    // moment cannot slip back in as new.
    let keep = 2 * NONCE_LIFETIME.as_millis() as u64;
    let mut spent = self.spent.lock().unwrap();
    spent.retain(|(_, issued_ms)| now_ms.saturating_sub(*issued_ms) <= keep);
    if spent.len() >= MAX_SPENT_NONCES || spent.iter().any(|(known, _)| known == nonce) {
      return false;
    }
    let issued_ms = u64::from_str_radix(&nonce[..16], 16).unwrap_or(now_ms);
    spent.push_back((nonce.to_string(), issued_ms));
    true
  }
}

fn now_ms() -> u64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|elapsed| elapsed.as_millis() as u64)
    .unwrap_or(0)
}

fn parse_add(body: &[u8]) -> Option<AddRequest> {
  let req: AddRequest = serde_json::from_slice(body).ok()?;
  // A URL must not be able to pass as a yt-dlp option.
  let url_ok = (req.url.starts_with("http://") || req.url.starts_with("https://"))
    && req.url.len() <= MAX_URL_BYTES;
  let headers_ok = req.headers.len() <= MAX_HEADERS
    && req.headers.iter().map(String::len).sum::<usize>() <= MAX_HEADER_BYTES
    && req.headers.iter().all(|h| is_safe_header(h));
  (url_ok && headers_ok).then_some(req)
}

/// Reads one HTTP request (head + Content-Length body), or says why not.
async fn read_request(stream: &mut (impl AsyncRead + Unpin)) -> Result<Vec<u8>, &'static str> {
  const TOO_LARGE: &str = "413 Payload Too Large";
  let mut buf = Vec::new();
  let mut chunk = [0u8; 8192];
  // Where the head ends and how long the body is, once the head is complete.
  let mut frame: Option<(usize, usize)> = None;
  loop {
    if frame.is_none() {
      // Only the bytes that are new can complete the head (and the three before them).
      let from = buf.len().saturating_sub(chunk.len() + 3);
      if let Some(head_end) = find_head_end(&buf[from..]).map(|at| from + at) {
        let head = String::from_utf8_lossy(&buf[..head_end]);
        let body_len = header(&head, "content-length")
          .and_then(|v| v.parse::<usize>().ok())
          .unwrap_or(0);
        if body_len > MAX_REQUEST {
          return Err(TOO_LARGE);
        }
        frame = Some((head_end, body_len));
      } else if buf.len() > MAX_HEAD {
        return Err("431 Request Header Fields Too Large");
      }
    }
    if let Some((head_end, body_len)) = frame {
      if buf.len() >= head_end + 4 + body_len {
        return Ok(buf);
      }
    }
    let n = stream.read(&mut chunk).await.unwrap_or(0);
    if n == 0 {
      return Err("400 Bad Request");
    }
    buf.extend_from_slice(&chunk[..n]);
  }
}

fn find_head_end(buf: &[u8]) -> Option<usize> {
  buf.windows(4).position(|w| w == b"\r\n\r\n")
}

fn header<'a>(head: &'a str, name: &str) -> Option<&'a str> {
  head.lines().skip(1).find_map(|line| {
    let (key, value) = line.split_once(':')?;
    key.trim().eq_ignore_ascii_case(name).then(|| value.trim())
  })
}

fn is_token(value: &str) -> bool {
  (1..=128).contains(&value.len()) && value.chars().all(|c| c.is_ascii_alphanumeric())
}

/// HMAC-SHA256 (RFC 2104) of the concatenated parts, as lowercase hex.
fn hmac_hex(key: &str, parts: &[&[u8]]) -> String {
  const BLOCK: usize = 64;
  let mut block = [0u8; BLOCK];
  if key.len() > BLOCK {
    block[..32].copy_from_slice(&Sha256::digest(key.as_bytes()));
  } else {
    block[..key.len()].copy_from_slice(key.as_bytes());
  }
  let mut inner = Sha256::new();
  inner.update(block.map(|b| b ^ 0x36));
  for part in parts {
    inner.update(part);
  }
  let mut outer = Sha256::new();
  outer.update(block.map(|b| b ^ 0x5c));
  outer.update(inner.finalize());
  hex::encode(outer.finalize())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
  a.len() == b.len() && a.iter().zip(b).fold(0u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

/// The key lives in the user's own data folder, readable by this user only.
fn load_or_create_key(path: &Path) -> std::io::Result<String> {
  if let Ok(key) = std::fs::read_to_string(path) {
    let key = key.trim();
    // Lowercase only: the extension sends it that way, and the proofs are case-sensitive.
    if key.len() == KEY_LEN && key.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f')) {
      return Ok(key.to_string());
    }
  }
  let key = format!(
    "{}{}",
    uuid::Uuid::new_v4().simple(),
    uuid::Uuid::new_v4().simple()
  );
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent)?;
  }
  let _ = std::fs::remove_file(path);
  private_file(path)?.write_all(key.as_bytes())?;
  Ok(key)
}

/// A header is handed to yt-dlp as `--add-header NAME: VALUE`. The page that made
/// the original request chose it, so it must be a plain header and nothing more.
fn is_safe_header(header: &str) -> bool {
  let Some((name, _)) = header.split_once(':') else {
    return false;
  };
  let plain_name = !name.is_empty()
    && name
      .chars()
      .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
  let lower = name.to_ascii_lowercase();
  // yt-dlp reads these as instructions to itself, such as which proxy to use.
  let internal = lower.starts_with("ytdl-") || lower.starts_with("youtubedl-");
  // These describe one connection, or are ours to send: cookies travel as a file.
  let per_connection = lower.starts_with("proxy-")
    || matches!(
      lower.as_str(),
      "cookie" | "host" | "content-length" | "transfer-encoding" | "connection"
    );
  // Printable ASCII only: a line break would smuggle in a second header, and yt-dlp
  // cannot send anything else.
  let printable = header.chars().all(|c| matches!(c, ' '..='~'));
  plain_name && !internal && !per_connection && printable
}

/// A page title is untrusted and unbounded, and it ends up in a file name.
fn clean_title(title: Option<String>) -> Option<String> {
  // Characters that are invisible or reorder the text around them.
  let invisible = |c: char| {
    c.is_control()
      || matches!(c, '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2060}'..='\u{2069}' | '\u{FEFF}')
  };
  let mut bytes = 0;
  let title: String = title?
    .chars()
    .filter(|c| !invisible(*c))
    .take(MAX_TITLE_CHARS)
    .take_while(|c| {
      bytes += c.len_utf8();
      bytes <= MAX_TITLE_BYTES
    })
    .collect();
  // No leading dot: ".." alone would name the parent directory, and dot files are hidden.
  let title = title.trim_matches(|c: char| c == '.' || c.is_whitespace());
  (!title.is_empty()).then(|| title.to_string())
}

fn create_private_dir(dir: &Path) -> std::io::Result<()> {
  let mut builder = std::fs::DirBuilder::new();
  builder.recursive(true);
  #[cfg(unix)]
  std::os::unix::fs::DirBuilderExt::mode(&mut builder, 0o700);
  builder.create(dir)
}

fn private_file(path: &Path) -> std::io::Result<std::fs::File> {
  let mut options = std::fs::OpenOptions::new();
  options.write(true).create_new(true);
  #[cfg(unix)]
  std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
  options.open(path)
}

fn write_cookie_file(dir: &Path, cookies: &str) -> std::io::Result<String> {
  // On demand: the directory may have been cleaned up since the last request.
  create_private_dir(dir)?;
  remove_oldest_beyond(dir, MAX_COOKIE_FILES - 1);
  let path = dir.join(format!("{}.txt", uuid::Uuid::new_v4()));
  private_file(&path)?.write_all(cookies.as_bytes())?;
  Ok(path.to_string_lossy().into_owned())
}

/// Keeps the newest `keep` files, so the folder cannot grow without end before the app exits.
fn remove_oldest_beyond(dir: &Path, keep: usize) {
  let Ok(entries) = std::fs::read_dir(dir) else {
    return;
  };
  let mut files: Vec<_> = entries
    .flatten()
    .filter_map(|entry| Some((entry.metadata().ok()?.modified().ok()?, entry.path())))
    .collect();
  files.sort();
  let excess = files.len().saturating_sub(keep);
  for (_, path) in files.into_iter().take(excess) {
    let _ = std::fs::remove_file(path);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  const JSON: &str = "application/json";
  const KEY: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const ADD: &str = r#"{"url":"https://a.test/v.m3u8","headers":["Referer: https://a.test/"],"cookies":"x","download":true,"title":"Clip"}"#;

  fn request(path: &str, origin: &str, content_type: &str, extra: &str, body: &str) -> Vec<u8> {
    format!(
      "POST {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: {origin}\r\nContent-Type: {content_type}\r\n{extra}Content-Length: {}\r\n\r\n{body}",
      body.len()
    )
    .into_bytes()
  }

  /// What the extension does: say hello, check the app's proof, then sign the request.
  fn hello(bridge: &Bridge) -> String {
    let raw = request(
      "/hello",
      EXTENSION_ORIGIN,
      JSON,
      "",
      r#"{"nonce":"abc123"}"#,
    );
    let reply = bridge.route(&raw);
    assert_eq!(reply.status, "200 OK");
    let body: serde_json::Value = serde_json::from_str(&reply.body.unwrap()).unwrap();
    assert_eq!(body["proof"], hmac_hex(KEY, &[b"app:abc123"]));
    body["nonce"].as_str().unwrap().to_string()
  }

  fn signed_add(key: &str, nonce: &str, body: &str) -> Vec<u8> {
    let proof = hmac_hex(key, &[b"ext:", nonce.as_bytes(), b":", body.as_bytes()]);
    let auth = format!("X-OVD-Nonce: {nonce}\r\nX-OVD-Proof: {proof}\r\n");
    request(
      "/add",
      EXTENSION_ORIGIN,
      "application/json; charset=utf-8",
      &auth,
      body,
    )
  }

  #[test]
  fn hmac_matches_the_standard_and_the_extension() {
    // RFC 4231, test case 2.
    assert_eq!(
      hmac_hex("Jefe", &[b"what do ya want ", b"for nothing?"]),
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
    );
    // The same vectors are checked in extension/detect.test.js, so both sides agree.
    assert_eq!(
      hmac_hex(KEY, &[b"app:abc123"]),
      "a75708d9c871060924d5d414e08fc2e57deaa6e1a48469824224631fa7fb055d"
    );
  }

  #[test]
  fn accepts_a_link_signed_with_the_key() {
    let bridge = Bridge::new(KEY.into());
    let nonce = hello(&bridge);
    let reply = bridge.route(&signed_add(KEY, &nonce, ADD));
    assert_eq!(reply.status, "200 OK");
    let Some(Action::Add(req)) = reply.action else {
      panic!("expected the link to be accepted");
    };
    assert_eq!(req.url, "https://a.test/v.m3u8");
    assert_eq!(req.headers, vec!["Referer: https://a.test/"]);
    assert_eq!(req.cookies, "x");
    assert!(req.download);
    assert_eq!(req.title.as_deref(), Some("Clip"));
  }

  #[test]
  fn optional_fields_default() {
    let req = parse_add(br#"{"url":"http://a.test/"}"#).unwrap();
    assert!(req.headers.is_empty() && req.cookies.is_empty() && !req.download);
    assert_eq!(req.title, None);
  }

  #[test]
  fn refuses_a_link_without_proof_of_the_key() {
    let bridge = Bridge::new(KEY.into());

    // Signed with another key.
    let nonce = hello(&bridge);
    let other_key = "f".repeat(64);
    assert_eq!(
      bridge.route(&signed_add(&other_key, &nonce, ADD)).status,
      "401 Unauthorized"
    );
    // A failed attempt does not use the challenge up: someone without the key cannot
    // spoil it for the extension.
    assert_eq!(bridge.route(&signed_add(KEY, &nonce, ADD)).status, "200 OK");

    // A challenge the app never gave out, even one that looks the part.
    assert_eq!(
      bridge.route(&signed_add(KEY, "0000", ADD)).status,
      "401 Unauthorized"
    );
    let forged = Bridge::new(other_key.clone()).issue_nonce();
    assert_eq!(
      bridge.route(&signed_add(KEY, &forged, ADD)).status,
      "401 Unauthorized"
    );

    // No proof at all.
    let bare = request("/add", EXTENSION_ORIGIN, JSON, "", ADD);
    assert_eq!(bridge.route(&bare).status, "401 Unauthorized");

    // A body changed after signing.
    let nonce = hello(&bridge);
    let proof = hmac_hex(KEY, &[b"ext:", nonce.as_bytes(), b":", ADD.as_bytes()]);
    let auth = format!("X-OVD-Nonce: {nonce}\r\nX-OVD-Proof: {proof}\r\n");
    let tampered = ADD.replace("a.test/v.m3u8", "evil.test/v.m3u8");
    let reply = bridge.route(&request("/add", EXTENSION_ORIGIN, JSON, &auth, &tampered));
    assert_eq!(reply.status, "401 Unauthorized");
  }

  #[test]
  fn a_proof_works_once_and_only_for_a_while() {
    let bridge = Bridge::new(KEY.into());
    let nonce = hello(&bridge);
    assert_eq!(bridge.route(&signed_add(KEY, &nonce, ADD)).status, "200 OK");
    assert_eq!(
      bridge.route(&signed_add(KEY, &nonce, ADD)).status,
      "401 Unauthorized"
    );

    let lifetime = NONCE_LIFETIME.as_millis() as u64;
    let stale = bridge.nonce_at(now_ms() - lifetime - 1000);
    assert_eq!(
      bridge.route(&signed_add(KEY, &stale, ADD)).status,
      "401 Unauthorized"
    );
    let from_the_future = bridge.nonce_at(now_ms() + 60_000);
    assert_eq!(
      bridge.route(&signed_add(KEY, &from_the_future, ADD)).status,
      "401 Unauthorized"
    );
    let recent = bridge.nonce_at(now_ms() - lifetime + 5000);
    assert_eq!(
      bridge.route(&signed_add(KEY, &recent, ADD)).status,
      "200 OK"
    );
  }

  #[test]
  fn asking_for_challenges_does_not_spoil_anyone_elses() {
    let bridge = Bridge::new(KEY.into());
    let first = hello(&bridge);
    // Anything that can reach the port can ask, as often as it likes.
    for _ in 0..2000 {
      hello(&bridge);
    }
    assert!(bridge.spent.lock().unwrap().is_empty());
    assert_eq!(bridge.route(&signed_add(KEY, &first, ADD)).status, "200 OK");
    assert_eq!(bridge.spent.lock().unwrap().len(), 1);
  }

  #[test]
  fn hello_needs_a_plain_nonce() {
    let bridge = Bridge::new(KEY.into());
    for body in [r#"{"nonce":""}"#, r#"{"nonce":"a b"}"#, r#"{}"#, "not json"] {
      let raw = request("/hello", EXTENSION_ORIGIN, JSON, "", body);
      assert_eq!(bridge.route(&raw).status, "400 Bad Request", "{body}");
    }
  }

  #[test]
  fn pairing_asks_one_question_at_a_time() {
    let bridge = Bridge::new(KEY.into());
    let raw = request("/pair", EXTENSION_ORIGIN, JSON, "", "{}");
    let reply = bridge.route(&raw);
    assert_eq!(reply.status, "202 Accepted");
    assert!(matches!(reply.action, Some(Action::Pair)));
    // Until the dialog is answered, asking again does nothing.
    assert_eq!(bridge.route(&raw).status, "429 Too Many Requests");
    // Nor right after it was answered: a refusal is not an invitation to ask again.
    bridge.pairing.store(false, Ordering::SeqCst);
    *bridge.pair_again.lock().unwrap() = Instant::now() + PAIR_AGAIN_AFTER_REFUSAL;
    assert_eq!(bridge.route(&raw).status, "429 Too Many Requests");
    assert!(!bridge.pairing.load(Ordering::SeqCst));
    *bridge.pair_again.lock().unwrap() = Instant::now();
    assert_eq!(bridge.route(&raw).status, "202 Accepted");
  }

  #[test]
  fn header_names_are_case_insensitive() {
    let bridge = Bridge::new(KEY.into());
    let body = r#"{"nonce":"abc123"}"#;
    let raw = format!(
      "POST /hello HTTP/1.1\r\norigin: {EXTENSION_ORIGIN}\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{body}",
      body.len()
    );
    assert_eq!(bridge.route(raw.as_bytes()).status, "200 OK");
  }

  #[test]
  fn rejects_every_origin_but_the_extension() {
    let bridge = Bridge::new(KEY.into());
    for path in ["/pair", "/hello", "/add"] {
      for origin in [
        "https://evil.test",
        "null",
        "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "http://127.0.0.1:46123",
      ] {
        let raw = request(path, origin, JSON, "", "{}");
        assert_eq!(
          bridge.route(&raw).status,
          "403 Forbidden",
          "{path} {origin}"
        );
      }
    }
    let no_origin = b"POST /pair HTTP/1.1\r\nContent-Type: application/json\r\n\r\n";
    assert_eq!(bridge.route(no_origin).status, "403 Forbidden");
    assert!(!bridge.pairing.load(Ordering::SeqCst));
  }

  #[test]
  fn rejects_requests_a_browser_sends_without_asking_first() {
    let bridge = Bridge::new(KEY.into());
    let raw = request(
      "/pair",
      EXTENSION_ORIGIN,
      "text/plain;charset=UTF-8",
      "",
      "{}",
    );
    assert_eq!(bridge.route(&raw).status, "415 Unsupported Media Type");
  }

  #[test]
  fn rejects_other_paths_and_methods() {
    let bridge = Bridge::new(KEY.into());
    let get = format!("GET /add HTTP/1.1\r\nOrigin: {EXTENSION_ORIGIN}\r\n\r\n");
    assert_eq!(bridge.route(get.as_bytes()).status, "404 Not Found");
    let options = b"OPTIONS /add HTTP/1.1\r\nOrigin: https://evil.test\r\n\r\n";
    assert_eq!(bridge.route(options).status, "404 Not Found");
    let other = request("/other", EXTENSION_ORIGIN, JSON, "", "{}");
    assert_eq!(bridge.route(&other).status, "404 Not Found");
    assert_eq!(bridge.route(b"garbage").status, "400 Bad Request");
  }

  #[test]
  fn rejects_urls_that_could_pass_as_options() {
    for url in [
      "--exec=rm",
      "-o",
      "file:///etc/passwd",
      "javascript:alert(1)",
    ] {
      let body = format!(r#"{{"url":"{url}"}}"#);
      assert!(parse_add(body.as_bytes()).is_none(), "{url}");
    }
    // A signed request is still checked.
    let bridge = Bridge::new(KEY.into());
    let nonce = hello(&bridge);
    let reply = bridge.route(&signed_add(KEY, &nonce, r#"{"url":"--exec=rm"}"#));
    assert_eq!(reply.status, "400 Bad Request");
  }

  #[test]
  fn only_plain_headers_are_safe() {
    for header in [
      "Referer: https://a.test/",
      "Authorization: Bearer a:b",
      "X_Custom-1: v",
    ] {
      assert!(is_safe_header(header), "{header}");
    }
    for header in [
      "--exec",
      ": value",
      "a b: c",
      "x.y: z",
      "A: b\r\nC: d",
      "A: b\nC: d",
      "Ytdl-Request-Proxy: http://evil.test:8080",
      "ytdl-socks-proxy: socks5://evil.test",
      "Youtubedl-No-Compression: 1",
      "Cookie: a=b",
      "Host: evil.test",
      "Proxy-Authorization: Basic x",
      "Transfer-Encoding: chunked",
      "X-Name: caf\u{e9}",
      "X-Tab: a\tb",
    ] {
      assert!(!is_safe_header(header), "{header}");
    }
    let body = r#"{"url":"https://a.test/","headers":["Ytdl-Request-Proxy: http://evil.test"]}"#;
    assert!(parse_add(body.as_bytes()).is_none());
  }

  #[test]
  fn a_link_is_bounded_in_size() {
    let with = |url: &str, headers: &[String]| {
      let body = serde_json::json!({ "url": url, "headers": headers }).to_string();
      parse_add(body.as_bytes()).is_some()
    };
    let header = |n: usize| format!("X-H{n}: v");
    let few: Vec<String> = (0..MAX_HEADERS).map(header).collect();
    let many: Vec<String> = (0..=MAX_HEADERS).map(header).collect();
    assert!(with("https://a.test/", &few));
    assert!(!with("https://a.test/", &many));
    let big = format!("X-Big: {}", "v".repeat(MAX_HEADER_BYTES));
    assert!(!with("https://a.test/", &[big]));
    assert!(with(&format!("https://a.test/{}", "p".repeat(4000)), &[]));
    assert!(!with(
      &format!("https://a.test/{}", "p".repeat(MAX_URL_BYTES)),
      &[]
    ));
  }

  #[test]
  fn clean_title_makes_a_safe_bounded_name() {
    assert_eq!(
      clean_title(Some("  My\n Video\t ".into())).as_deref(),
      Some("My Video")
    );
    assert_eq!(
      clean_title(Some("..hidden. ".into())).as_deref(),
      Some("hidden")
    );
    // Right-to-left override and zero-width characters can disguise a name.
    assert_eq!(
      clean_title(Some("safe\u{202E}gpj.exe\u{200B}".into())).as_deref(),
      Some("safegpj.exe")
    );
    for empty in [" \n ", "..", ". .", "\u{200B}"] {
      assert_eq!(clean_title(Some(empty.into())), None, "{empty:?}");
    }
    assert_eq!(clean_title(None), None);
    assert_eq!(clean_title(Some("a".repeat(400))).unwrap().len(), 150);
    // File names are limited in bytes, and some scripts need three or four per character.
    let wide = clean_title(Some("語".repeat(400))).unwrap();
    assert!(wide.len() <= MAX_TITLE_BYTES && wide.chars().count() == 66);
  }

  #[tokio::test]
  async fn read_request_waits_for_the_whole_body() {
    let raw = b"POST /add HTTP/1.1\r\nContent-Length: 5\r\n\r\nhello";
    // One byte per read, as a slow client would send it.
    let mut slow = Slow(raw);
    assert_eq!(read_request(&mut slow).await.as_deref(), Ok(&raw[..]));

    let mut no_body = &b"GET / HTTP/1.1\r\nHost: x\r\n\r\n"[..];
    assert!(read_request(&mut no_body).await.is_ok());
  }

  #[tokio::test]
  async fn read_request_gives_up_on_short_or_oversized_requests() {
    let mut cut_off = &b"POST /add HTTP/1.1\r\nContent-Length: 50\r\n\r\nhello"[..];
    assert_eq!(read_request(&mut cut_off).await, Err("400 Bad Request"));

    let mut no_head = &b"POST /add HTTP/1.1\r\nContent-Length: 5"[..];
    assert_eq!(read_request(&mut no_head).await, Err("400 Bad Request"));

    let declared = format!(
      "POST /add HTTP/1.1\r\nContent-Length: {}\r\n\r\n",
      MAX_REQUEST + 1
    );
    assert_eq!(
      read_request(&mut declared.as_bytes()).await,
      Err("413 Payload Too Large")
    );

    let endless_head = vec![b'a'; 4 * MAX_HEAD];
    assert_eq!(
      read_request(&mut endless_head.as_slice()).await,
      Err("431 Request Header Fields Too Large")
    );

    // The largest allowed body is still read whole.
    let body = "x".repeat(MAX_REQUEST);
    let request = format!("POST /add HTTP/1.1\r\nContent-Length: {MAX_REQUEST}\r\n\r\n{body}");
    let read = read_request(&mut request.as_bytes()).await.unwrap();
    assert_eq!(read.len(), request.len());
  }

  /// Hands out its data one byte per read.
  struct Slow<'a>(&'a [u8]);
  impl AsyncRead for Slow<'_> {
    fn poll_read(
      mut self: std::pin::Pin<&mut Self>,
      _cx: &mut std::task::Context<'_>,
      buf: &mut tokio::io::ReadBuf<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
      let n = self.0.len().min(1);
      buf.put_slice(&self.0[..n]);
      self.0 = &self.0[n..];
      std::task::Poll::Ready(Ok(()))
    }
  }

  fn temp_dir() -> PathBuf {
    std::env::temp_dir().join(format!("ovd-bridge-test-{}", uuid::Uuid::new_v4()))
  }

  #[cfg(unix)]
  fn mode(path: &Path) -> u32 {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path).unwrap().permissions().mode() & 0o777
  }

  #[test]
  fn cookie_file_is_private_and_its_directory_is_made_on_demand() {
    let root = temp_dir();
    let dir = root.join("bridge-cookies");
    let path = write_cookie_file(&dir, "# Netscape HTTP Cookie File\n").unwrap();
    assert_eq!(
      std::fs::read_to_string(&path).unwrap(),
      "# Netscape HTTP Cookie File\n"
    );
    #[cfg(unix)]
    {
      assert_eq!(mode(Path::new(&path)), 0o600);
      assert_eq!(mode(&dir), 0o700);
    }
    // A second file lands next to the first without disturbing it.
    let second = write_cookie_file(&dir, "x").unwrap();
    assert_ne!(path, second);
    assert!(Path::new(&path).exists());
    std::fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn old_cookie_files_make_way_for_new_ones() {
    let dir = temp_dir();
    std::fs::create_dir_all(&dir).unwrap();
    for name in ["a", "b", "c"] {
      std::fs::write(dir.join(name), name).unwrap();
      std::thread::sleep(Duration::from_millis(20));
    }
    remove_oldest_beyond(&dir, 2);
    let mut left: Vec<_> = std::fs::read_dir(&dir)
      .unwrap()
      .map(|entry| entry.unwrap().file_name().into_string().unwrap())
      .collect();
    left.sort();
    assert_eq!(left, ["b", "c"]);
    std::fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn the_key_is_made_once_and_kept_private() {
    let dir = temp_dir();
    let path = dir.join("bridge-key");
    let key = load_or_create_key(&path).unwrap();
    assert_eq!(key.len(), KEY_LEN);
    assert!(key.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f')));
    #[cfg(unix)]
    assert_eq!(mode(&path), 0o600);
    assert_eq!(load_or_create_key(&path).unwrap(), key);

    // A damaged file is replaced rather than trusted, and so is one in capitals, which
    // the extension could never match.
    for damaged in ["short".to_string(), "ABCDEF0123456789".repeat(4)] {
      std::fs::write(&path, &damaged).unwrap();
      let replaced = load_or_create_key(&path).unwrap();
      assert_ne!(replaced, damaged);
      assert_eq!(replaced.len(), KEY_LEN);
      assert_eq!(replaced, replaced.to_lowercase());
    }
    std::fs::remove_dir_all(dir).unwrap();
  }
}
