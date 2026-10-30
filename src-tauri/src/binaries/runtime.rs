//! Adapt individually resolved tools to yt-dlp's directory-based FFmpeg API.
use super::resolver::{executable_name, DependencyReport, ResolvedDependency};
use sha2::{Digest, Sha256};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct RuntimePaths {
  pub ytdlp: PathBuf,
  pub deno: PathBuf,
  pub ffmpeg_dir: PathBuf,
  pub search_path: OsString,
}

impl RuntimePaths {
  pub fn command(&self, args: &[String]) -> Command {
    let mut command = Command::new(&self.ytdlp);
    let mut deno_argument = OsString::from("deno:");
    deno_argument.push(&self.deno);
    command
      .args(["--no-js-runtimes", "--js-runtimes"])
      .arg(deno_argument)
      .arg("--ffmpeg-location")
      .arg(&self.ffmpeg_dir)
      .args(args)
      .env("PATH", &self.search_path);
    command
  }
}

pub async fn prepare(
  reports: &[DependencyReport],
  runtime_root: &Path,
) -> Result<RuntimePaths, String> {
  let required = |name: &str| -> Result<&ResolvedDependency, String> {
    reports.iter().find(|r| r.tool == name).and_then(|r| r.active.as_ref())
      .ok_or_else(|| format!("{name}: no validated executable available; check dependency settings or install missing tools"))
  };
  let ytdlp = required("yt-dlp")?;
  let ffmpeg = required("ffmpeg")?;
  let ffprobe = required("ffprobe")?;
  let deno = required("deno")?;
  let atomic = reports
    .iter()
    .find(|r| r.tool == "AtomicParsley")
    .and_then(|r| r.active.as_ref());
  let mut paths = Vec::new();
  let ffmpeg_dir = if ffmpeg.path.parent() == ffprobe.path.parent()
    && ffmpeg
      .path
      .file_name()
      .is_some_and(|n| n == executable_name("ffmpeg").as_str())
    && ffprobe
      .path
      .file_name()
      .is_some_and(|n| n == executable_name("ffprobe").as_str())
  {
    ffmpeg
      .path
      .parent()
      .ok_or("FFmpeg has no parent directory")?
      .to_path_buf()
  } else {
    alias_directory(runtime_root, &[ffmpeg.clone(), ffprobe.clone()]).await?
  };
  // AtomicParsley has no explicit path flag in yt-dlp. A private alias directory
  // puts exactly the selected executable first, including manually renamed files.
  if let Some(atomic) = atomic {
    if atomic
      .path
      .file_name()
      .is_some_and(|n| n == executable_name("AtomicParsley").as_str())
    {
      paths.push(
        atomic
          .path
          .parent()
          .ok_or("AtomicParsley has no parent")?
          .to_path_buf(),
      );
    } else {
      paths.push(alias_directory(runtime_root, std::slice::from_ref(atomic)).await?);
    }
  }
  paths.push(ffmpeg_dir.clone());
  // Preserve the inherited environment for Python/pip launchers and optional
  // user helpers, filtering implicit current-directory entries.
  paths.extend(super::resolver::search_directories(std::env::var_os(
    "PATH",
  )));
  let search_path = std::env::join_paths(paths).map_err(|e| e.to_string())?;
  Ok(RuntimePaths {
    ytdlp: ytdlp.path.clone(),
    deno: deno.path.clone(),
    ffmpeg_dir,
    search_path,
  })
}

async fn alias_directory(root: &Path, tools: &[ResolvedDependency]) -> Result<PathBuf, String> {
  let root = root.to_path_buf();
  let tools = tools.to_vec();
  tokio::task::spawn_blocking(move || {
    let mut hash = Sha256::new();
    for tool in &tools {
      hash.update(tool.tool.as_bytes());
      hash.update(tool.path.as_os_str().as_encoded_bytes());
      let meta = std::fs::metadata(&tool.path).map_err(|e| e.to_string())?;
      hash.update(format!("{}:{:?}", meta.len(), meta.modified()).as_bytes());
      #[cfg(windows)]
      if let Some(parent) = tool.path.parent() {
        for entry in std::fs::read_dir(parent).map_err(|e| e.to_string())? {
          let entry = entry.map_err(|e| e.to_string())?;
          if entry.path().extension().is_some_and(|e| e.eq_ignore_ascii_case("dll")) {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            hash.update(entry.file_name().as_encoded_bytes());
            hash.update(format!("{}:{:?}", metadata.len(), metadata.modified()).as_bytes());
          }
        }
      }
    }
    let dir = root.join(hex::encode(hash.finalize()));
    if dir.join(".ready").exists() { return Ok(dir); }
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let staging = root.join(format!(".stage-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&staging).map_err(|e| e.to_string())?;
    let result = (|| {
      for tool in &tools {
        let dest = staging.join(executable_name(&tool.tool));
        #[cfg(unix)]
        std::os::unix::fs::symlink(&tool.path, &dest).map_err(|e| e.to_string())?;
        #[cfg(windows)]
        {
          // Symlinks need privileges on many Windows systems. Copy the selected
          // exe and its adjacent DLLs into user storage instead. System files
          // are never modified. Conflicting DLLs fail closed.
          std::fs::copy(&tool.path, &dest).map_err(|e| e.to_string())?;
          if let Some(parent) = tool.path.parent() {
            for entry in std::fs::read_dir(parent).map_err(|e| e.to_string())? {
              let entry = entry.map_err(|e| e.to_string())?;
              if !entry.path().extension().is_some_and(|e| e.eq_ignore_ascii_case("dll")) { continue; }
              let target = staging.join(entry.file_name());
              if target.exists() {
                if std::fs::read(&target).map_err(|e| e.to_string())? != std::fs::read(entry.path()).map_err(|e| e.to_string())? {
                  return Err("resolved tools have conflicting DLLs; select FFmpeg and FFprobe from the same installation".into());
                }
              } else { std::fs::copy(entry.path(), target).map_err(|e| e.to_string())?; }
            }
          }
          // Validate the copied executable in its actual runtime location.
          super::resolver::probe(&dest, &[if tool.tool == "AtomicParsley" { "--version" } else { "-version" }], std::time::Duration::from_secs(5))?;
        }
      }
      std::fs::write(staging.join(".ready"), []).map_err(|e| e.to_string())?;
      std::fs::rename(&staging, &dir).map_err(|e| e.to_string())?;
      Ok(dir)
    })();
    if result.is_err() { let _ = std::fs::remove_dir_all(&staging); }
    result
  }).await.map_err(|e| e.to_string())?
}
