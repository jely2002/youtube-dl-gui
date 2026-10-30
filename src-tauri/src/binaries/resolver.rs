//! Local executable discovery. Manifest versions are preferred download versions,
//! never minimum versions for independently installed programs.
use crate::runners::ytdlp_process::{configure_command, platform_process_from_child};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime};

pub const TOOLS: [&str; 5] = ["yt-dlp", "ffmpeg", "ffprobe", "deno", "AtomicParsley"];
const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const OUTPUT_LIMIT: u64 = 512 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
  Configured,
  System,
  Bundled,
  Managed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
  Compatible,
  OutdatedCompatible,
  Missing,
  Incompatible,
  UnableToExecute,
  ConfiguredInvalid,
  Unavailable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedDependency {
  pub tool: String,
  pub path: PathBuf,
  pub source: Source,
  pub version: String,
  pub status: Status,
  /// Actual execution is authoritative for native, universal and emulated files.
  pub compatibility: String,
  #[serde(skip)]
  pub avformat_major: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rejection {
  pub path: PathBuf,
  pub status: Status,
  pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyReport {
  pub tool: String,
  pub locked: bool,
  pub active: Option<ResolvedDependency>,
  pub status: Status,
  pub diagnostics: Vec<Rejection>,
}

impl DependencyReport {
  pub fn requires_install(&self) -> bool {
    self.active.is_none() && self.status != Status::ConfiguredInvalid
  }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DependencySettings {
  /// Keys are tool identifiers in TOOLS. Empty values mean automatic selection.
  pub paths: BTreeMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct Discovery {
  pub bin_dir: PathBuf,
  pub search_dirs: Vec<PathBuf>,
  pub configured: DependencySettings,
  pub locked: bool,
}

impl Discovery {
  pub fn from_environment(bin_dir: PathBuf, configured: DependencySettings, locked: bool) -> Self {
    let mut dirs = search_directories(std::env::var_os("PATH"));
    #[cfg(unix)]
    {
      #[cfg(target_os = "macos")]
      dirs.push(PathBuf::from("/opt/homebrew/bin"));
      dirs.extend(["/usr/local/bin", "/usr/bin", "/bin"].map(PathBuf::from));
      if let Some(home) = std::env::var_os("HOME") {
        dirs.push(PathBuf::from(&home).join(".local/bin"));
        dirs.push(PathBuf::from(home).join(".deno/bin"));
      }
    }
    #[cfg(windows)]
    {
      for (variable, suffix) in [
        ("USERPROFILE", "scoop/shims"),
        ("USERPROFILE", ".deno/bin"),
        ("LOCALAPPDATA", "Microsoft/WinGet/Links"),
        ("ProgramData", "chocolatey/bin"),
      ] {
        if let Some(base) = std::env::var_os(variable) {
          dirs.push(PathBuf::from(base).join(suffix));
        }
      }
    }
    let cwd = std::env::current_dir()
      .ok()
      .and_then(|p| p.canonicalize().ok());
    let managed = bin_dir.canonicalize().ok();
    let mut seen = HashSet::new();
    dirs.retain(|dir| {
      let Ok(real) = dir.canonicalize() else {
        return false;
      };
      if Some(&real) == cwd.as_ref() || Some(&real) == managed.as_ref() {
        return false;
      }
      #[cfg(unix)]
      {
        use std::os::unix::fs::PermissionsExt;
        if std::fs::metadata(&real).is_ok_and(|m| m.permissions().mode() & 0o002 != 0) {
          return false;
        }
      }
      seen.insert(real)
    });
    Self {
      bin_dir,
      search_dirs: dirs,
      configured,
      locked,
    }
  }
}

pub fn search_directories(path: Option<OsString>) -> Vec<PathBuf> {
  path
    .map(|p| {
      std::env::split_paths(&p)
        .filter(|d| d.is_absolute())
        .collect()
    })
    .unwrap_or_default()
}

pub fn executable_name(tool: &str) -> String {
  if cfg!(windows) {
    format!("{tool}.exe")
  } else {
    tool.to_owned()
  }
}

/// Only the documented macOS AtomicParsley translation fallback is permitted.
/// Never select an arbitrary asset merely because its OS prefix matches.
pub fn asset_platform<'a>(
  tool: &str,
  platform: &'a str,
  available: impl Fn(&str) -> bool,
) -> Option<&'a str> {
  if available(platform) {
    Some(platform)
  } else if tool == "AtomicParsley" && platform == "darwin-aarch64" && available("darwin-x86_64") {
    Some("darwin-x86_64")
  } else {
    None
  }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Fingerprint {
  real: PathBuf,
  len: u64,
  modified: SystemTime,
  #[cfg(unix)]
  mode: u32,
}

fn fingerprint(path: &Path) -> Result<Fingerprint, String> {
  if !path.is_absolute() {
    return Err("an absolute executable path is required".into());
  }
  let real = path.canonicalize().map_err(|e| e.to_string())?;
  let metadata = std::fs::metadata(&real).map_err(|e| e.to_string())?;
  if !metadata.is_file() {
    return Err("not a regular file".into());
  }
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    if metadata.permissions().mode() & 0o111 == 0 {
      return Err("file is not executable".into());
    }
  }
  #[cfg(windows)]
  if !real
    .extension()
    .is_some_and(|v| v.eq_ignore_ascii_case("exe"))
  {
    return Err("only .exe executables are supported; shell scripts are not executed".into());
  }
  Ok(Fingerprint {
    real,
    len: metadata.len(),
    modified: metadata.modified().map_err(|e| e.to_string())?,
    #[cfg(unix)]
    mode: {
      use std::os::unix::fs::PermissionsExt;
      metadata.permissions().mode()
    },
  })
}

#[derive(Debug, Clone)]
struct Validation {
  version: String,
  avformat_major: Option<u32>,
}

#[derive(Default)]
pub struct Resolver {
  // Only successful validations are cached, for at most 30s; fingerprints are
  // rechecked on every resolution. A removed/retargeted/changed file is not reused.
  cache: HashMap<(String, PathBuf), (Fingerprint, Instant, Validation)>,
}

impl Resolver {
  pub async fn resolve(&mut self, discovery: &Discovery) -> Vec<DependencyReport> {
    let mut reports = Vec::new();
    let mut alternate_probes = Vec::new();
    for tool in TOOLS {
      let configured = discovery
        .configured
        .paths
        .get(tool)
        .filter(|p| !p.trim().is_empty());
      let mut candidates = Vec::new();
      if discovery.locked {
        candidates.push((
          discovery.bin_dir.join(executable_name(tool)),
          Source::Bundled,
        ));
      } else if let Some(path) = configured {
        candidates.push((PathBuf::from(path), Source::Configured));
      } else {
        if tool == "ffmpeg" {
          if let Some(parent) = discovery
            .configured
            .paths
            .get("ffprobe")
            .filter(|p| !p.trim().is_empty())
            .and_then(|p| Path::new(p).parent())
            .filter(|p| p.is_absolute())
          {
            candidates.push((parent.join(executable_name(tool)), Source::System));
          }
        }
        // Prefer ffprobe beside the selected ffmpeg, before other PATH entries.
        if tool == "ffprobe" {
          if let Some(parent) = reports.iter().find_map(|r: &DependencyReport| {
            r.active
              .as_ref()
              .filter(|a| {
                a.tool == "ffmpeg" && matches!(a.source, Source::System | Source::Configured)
              })
              .and_then(|a| a.path.parent())
          }) {
            candidates.push((parent.join(executable_name(tool)), Source::System));
          }
        }
        for dir in &discovery.search_dirs {
          candidates.push((dir.join(executable_name(tool)), Source::System));
          if tool == "AtomicParsley" {
            candidates.push((dir.join(executable_name("atomicparsley")), Source::System));
          }
        }
        candidates.push((
          discovery.bin_dir.join(executable_name(tool)),
          Source::Managed,
        ));
      }
      let mut report = DependencyReport {
        tool: tool.into(),
        locked: discovery.locked,
        active: None,
        status: Status::Missing,
        diagnostics: Vec::new(),
      };
      let mut seen = HashSet::new();
      for (path, source) in candidates {
        if !seen.insert(path.clone()) {
          continue;
        }
        if source == Source::System && !path.exists() {
          continue;
        }
        match self.validate(tool, &path).await {
          Ok(validation) => {
            let active = ResolvedDependency {
              tool: tool.into(),
              path,
              source,
              version: validation.version,
              status: Status::Compatible,
              compatibility: format!(
                "launched successfully on {}-{}",
                std::env::consts::OS,
                std::env::consts::ARCH
              ),
              avformat_major: validation.avformat_major,
            };
            if tool == "ffprobe" {
              if let Some(ffmpeg) = reports
                .iter()
                .find_map(|r| r.active.as_ref().filter(|a| a.tool == "ffmpeg"))
              {
                if !coherent_pair(ffmpeg, &active) {
                  alternate_probes.push(active.clone());
                  report.diagnostics.push(Rejection { path: active.path, status: Status::Incompatible, reason: "FFprobe libavformat ABI does not match selected FFmpeg; trying another candidate".into() });
                  report.status = Status::Incompatible;
                  continue;
                }
              }
            }
            report.active = Some(active);
            report.status = Status::Compatible;
            break;
          }
          Err((status, reason)) => {
            if status != Status::Missing || report.diagnostics.is_empty() {
              report.status = status;
            }
            report.diagnostics.push(Rejection {
              path,
              status,
              reason,
            });
          }
        }
      }
      if !discovery.locked && configured.is_some() && report.active.is_none() {
        report.status = Status::ConfiguredInvalid;
      }
      reports.push(report);
    }
    // A coherent lower-priority pair is preferable to downloading over an
    // existing installation. Pins still constrain the candidate set.
    if !alternate_probes.is_empty() && reports[2].active.is_none() {
      let pinned_ffmpeg = discovery
        .configured
        .paths
        .get("ffmpeg")
        .filter(|p| !p.trim().is_empty());
      let candidates = if discovery.locked {
        vec![(
          discovery.bin_dir.join(executable_name("ffmpeg")),
          Source::Bundled,
        )]
      } else if let Some(path) = pinned_ffmpeg {
        vec![(PathBuf::from(path), Source::Configured)]
      } else {
        discovery
          .search_dirs
          .iter()
          .map(|dir| (dir.join(executable_name("ffmpeg")), Source::System))
          .chain(std::iter::once((
            discovery.bin_dir.join(executable_name("ffmpeg")),
            Source::Managed,
          )))
          .collect()
      };
      for (path, source) in candidates {
        if let Ok(validation) = self.validate("ffmpeg", &path).await {
          let ffmpeg = ResolvedDependency {
            tool: "ffmpeg".into(),
            path,
            source,
            version: validation.version,
            status: Status::Compatible,
            compatibility: "validated coherent FFmpeg/FFprobe pair".into(),
            avformat_major: validation.avformat_major,
          };
          if let Some(ffprobe) = alternate_probes.iter().find(|p| coherent_pair(&ffmpeg, p)) {
            reports[1].active = Some(ffmpeg);
            reports[1].status = Status::Compatible;
            reports[2].active = Some(ffprobe.clone());
            reports[2].status = Status::Compatible;
            break;
          }
        }
      }
      if reports[2].active.is_none() && !discovery.locked && pinned_ffmpeg.is_none() {
        // These tools were individually valid, but no compatible combination
        // exists. Replacing the pair is necessary, not a redundant full-set download.
        reports[1].active = None;
        reports[1].status = Status::Incompatible;
        reports[1].diagnostics.push(Rejection {
          path: discovery.bin_dir.join(executable_name("ffmpeg")),
          status: Status::Incompatible,
          reason: "No coherent FFmpeg/FFprobe pair; managed pair required".into(),
        });
        if reports[2].status != Status::ConfiguredInvalid {
          reports[2].status = Status::Incompatible;
        }
      }
    }
    reports
  }

  async fn validate(&mut self, tool: &str, path: &Path) -> Result<Validation, (Status, String)> {
    let stamp = fingerprint(path).map_err(|e| {
      (
        if path.exists() {
          Status::UnableToExecute
        } else {
          Status::Missing
        },
        e,
      )
    })?;
    let key = (tool.to_string(), path.to_path_buf());
    if let Some((previous, time, validation)) = self.cache.get(&key) {
      if previous == &stamp && time.elapsed() < Duration::from_secs(30) {
        return Ok(validation.clone());
      }
    }
    self.cache.remove(&key);
    let owned_path = path.to_path_buf();
    let owned_tool = tool.to_owned();
    let validation =
      tokio::task::spawn_blocking(move || validate_executable(&owned_tool, &owned_path))
        .await
        .map_err(|e| (Status::UnableToExecute, e.to_string()))??;
    if fingerprint(path).ok().as_ref() != Some(&stamp) {
      return Err((
        Status::UnableToExecute,
        "executable changed during validation; retry discovery".into(),
      ));
    }
    self
      .cache
      .insert(key, (stamp, Instant::now(), validation.clone()));
    Ok(validation)
  }
}

pub fn coherent_pair(ffmpeg: &ResolvedDependency, ffprobe: &ResolvedDependency) -> bool {
  ffmpeg.avformat_major.is_some() && ffmpeg.avformat_major == ffprobe.avformat_major
}

fn version_numbers(version: &str) -> Vec<u32> {
  version
    .trim_start_matches(['v', 'n'])
    .split('.')
    .take(3)
    .map(|s| {
      s.chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>()
        .parse()
        .unwrap_or(0)
    })
    .collect()
}

pub fn older_than(current: &str, preferred: &str) -> bool {
  let a = version_numbers(current);
  let b = version_numbers(preferred);
  a.iter().any(|v| *v != 0) && b.iter().any(|v| *v != 0) && a < b
}

fn validate_executable(tool: &str, path: &Path) -> Result<Validation, (Status, String)> {
  let flag = match tool {
    "ffmpeg" | "ffprobe" => "-version",
    "AtomicParsley" => "--version",
    _ => "--version",
  };
  let output = probe(path, &[flag], PROBE_TIMEOUT).map_err(|e| (Status::UnableToExecute, e))?;
  let version = parse_identity(tool, &output).ok_or_else(|| {
    (
      Status::Incompatible,
      format!("output does not identify a supported {tool} version"),
    )
  })?;
  let avformat_major = output.lines().find_map(|line| {
    let rest = line.trim().strip_prefix("libavformat")?;
    rest.trim().split('.').next()?.trim().parse::<u32>().ok()
  });
  let minimum: &[u32] = match tool {
    "yt-dlp" => &[2025, 11, 12],
    "deno" => &[2, 3, 0],
    "ffmpeg" | "ffprobe" => &[4, 4, 0],
    "AtomicParsley" => &[0, 9, 0],
    _ => return Err((Status::Incompatible, "unknown dependency".into())),
  };
  let mut numbers = version_numbers(&version);
  numbers.resize(3, 0);
  // AtomicParsley also uses calendar release versions, which sort above 0.9.x.
  let ffmpeg_nightly = matches!(tool, "ffmpeg" | "ffprobe")
    && (version.starts_with("N-") || version.starts_with("git-"))
    && avformat_major.is_some_and(|major| major >= 58);
  if numbers.as_slice() < minimum && !ffmpeg_nightly {
    return Err((
      Status::Incompatible,
      format!(
        "{tool} {version} is below the minimum {}",
        minimum
          .iter()
          .map(u32::to_string)
          .collect::<Vec<_>>()
          .join(".")
      ),
    ));
  }
  let capability =
    |args: &[&str]| probe(path, args, PROBE_TIMEOUT).map_err(|e| (Status::UnableToExecute, e));
  match tool {
    "yt-dlp" => {
      let help = capability(&["--ignore-config", "--help"])?;
      for required in [
        "yt-dlp",
        "--js-runtimes",
        "--ffmpeg-location",
        "--progress-template",
        "--impersonate",
      ] {
        if !help.contains(required) {
          return Err((
            Status::Incompatible,
            format!("yt-dlp is missing required CLI capability {required}"),
          ));
        }
      }
    }
    "ffmpeg" => {
      let encoders = capability(&["-hide_banner", "-encoders"])?;
      for encoder in ["libmp3lame", "aac", "mjpeg"] {
        if !encoders.split_whitespace().any(|s| s == encoder) {
          return Err((
            Status::Incompatible,
            format!("FFmpeg lacks required encoder {encoder}"),
          ));
        }
      }
      let muxers = capability(&["-hide_banner", "-muxers"])?;
      for muxer in ["mp4", "mp3", "matroska"] {
        if !muxers
          .split_whitespace()
          .any(|s| s.split(',').any(|v| v == muxer))
        {
          return Err((
            Status::Incompatible,
            format!("FFmpeg lacks required muxer {muxer}"),
          ));
        }
      }
    }
    "ffprobe" => {
      let help = capability(&["-hide_banner", "-h", "full"])?;
      if !help.contains("-show_entries") || !help.contains("-of ") {
        return Err((
          Status::Incompatible,
          "FFprobe lacks structured metadata output".into(),
        ));
      }
    }
    "deno" => {
      let result = capability(&[
        "run",
        "--no-config",
        "--no-prompt",
        "--no-remote",
        "--no-npm",
        "--no-lock",
        "--node-modules-dir=none",
        "--no-code-cache",
        "--ext=js",
        "data:application/javascript,console.log('ovd-deno-ok')",
      ])?;
      if result.trim() != "ovd-deno-ok" {
        return Err((
          Status::Incompatible,
          "Deno failed the local JavaScript runtime check".into(),
        ));
      }
    }
    "AtomicParsley" => {
      let help = capability(&["--help"])?;
      if !help.contains("--artwork") {
        return Err((
          Status::Incompatible,
          "AtomicParsley lacks --artwork support".into(),
        ));
      }
    }
    _ => {}
  }
  if matches!(tool, "ffmpeg" | "ffprobe") && avformat_major.is_none() {
    return Err((
      Status::Incompatible,
      "cannot establish FFmpeg/FFprobe libavformat ABI".into(),
    ));
  }
  Ok(Validation {
    version,
    avformat_major,
  })
}

fn parse_identity(tool: &str, output: &str) -> Option<String> {
  let first = output.lines().find(|line| !line.trim().is_empty())?.trim();
  let version = match tool {
    "yt-dlp" => {
      let re = regex::Regex::new(r"^\d{4}\.\d{2}\.\d{2}(?:[.\w+-]*)?$").ok()?;
      if !re.is_match(first) {
        return None;
      }
      first
    }
    "ffmpeg" => first
      .strip_prefix("ffmpeg version ")?
      .split_whitespace()
      .next()?,
    "ffprobe" => first
      .strip_prefix("ffprobe version ")?
      .split_whitespace()
      .next()?,
    "deno" => first.strip_prefix("deno ")?.split_whitespace().next()?,
    "AtomicParsley" => first
      .strip_prefix("AtomicParsley version: ")
      .or_else(|| first.strip_prefix("AtomicParsley "))?
      .split_whitespace()
      .next()?,
    _ => return None,
  };
  Some(version.into())
}

/// Bounded time AND output. stdin is closed; no shell or interactive prompts.
/// The existing process-tree facility also contains child processes on Windows.
pub fn probe(path: &Path, args: &[&str], timeout: Duration) -> Result<String, String> {
  let mut command = Command::new(path);
  command.args(args);
  probe_command(command, timeout)
}

/// Execute an already configured command, retaining the resolver's bounded
/// output, deadline, and process-tree cleanup (including its explicit PATH).
pub fn probe_command(mut command: Command, timeout: Duration) -> Result<String, String> {
  command
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  configure_command(&mut command).map_err(|e| e.to_string())?;
  let start = Instant::now();
  #[cfg(unix)]
  let mut child = loop {
    match command.spawn() {
      Ok(child) => break child,
      Err(error) => {
        // Concurrent package-manager writes, or a fork briefly inheriting an
        // executable's writable descriptor, can cause transient ETXTBSY.
        if error.raw_os_error() == Some(libc::ETXTBSY)
          && start.elapsed() < timeout.min(Duration::from_millis(500))
        {
          std::thread::sleep(Duration::from_millis(10));
          continue;
        }
        return Err(format!("unable to launch: {error}"));
      }
    }
  };
  #[cfg(not(unix))]
  let mut child = command
    .spawn()
    .map_err(|error| format!("unable to launch: {error}"))?;
  let platform = match platform_process_from_child(&child) {
    Ok(p) => p,
    Err(e) => {
      let _ = child.kill();
      let _ = child.wait();
      return Err(e);
    }
  };
  let (tx, rx) = std::sync::mpsc::channel();
  for stream in [
    child
      .stdout
      .take()
      .map(|s| Box::new(s) as Box<dyn Read + Send>),
    child
      .stderr
      .take()
      .map(|s| Box::new(s) as Box<dyn Read + Send>),
  ]
  .into_iter()
  .flatten()
  {
    let tx = tx.clone();
    std::thread::spawn(move || {
      let mut bytes = Vec::new();
      let result = stream
        .take(OUTPUT_LIMIT + 1)
        .read_to_end(&mut bytes)
        .map(|_| bytes);
      let _ = tx.send(result);
    });
  }
  drop(tx);
  let status = loop {
    match child.try_wait() {
      Ok(Some(status)) => break Ok(status),
      Ok(None) if start.elapsed() < timeout => std::thread::sleep(Duration::from_millis(10)),
      Ok(None) => break Err("validation timed out".to_string()),
      Err(e) => break Err(e.to_string()),
    }
  };
  // Kill remaining descendants even if the leader exited but left pipes open.
  #[cfg(unix)]
  if let Some(pgid) = platform.pgid {
    unsafe {
      libc::killpg(pgid, libc::SIGKILL);
    }
  }
  #[cfg(windows)]
  crate::runners::ytdlp_process::kill_platform_process(&platform);
  let _ = child.kill();
  let _ = child.wait();
  let status = status?;
  let mut output = String::new();
  for _ in 0..2 {
    let bytes = rx
      .recv_timeout(timeout.saturating_sub(start.elapsed()))
      .map_err(|_| "validation output did not close")?
      .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > OUTPUT_LIMIT {
      return Err("validation output exceeded limit".into());
    }
    output.push_str(&String::from_utf8_lossy(&bytes));
    output.push('\n');
  }
  if !status.success() {
    return Err(format!(
      "validation exited with {status}: {}",
      output.trim().chars().take(400).collect::<String>()
    ));
  }
  Ok(output)
}

#[cfg(test)]
#[path = "resolver/tests.rs"]
mod tests;
