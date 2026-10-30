//! Opt-in native CI checks using signed upstream assets and production modules.
//! This module is not compiled into ordinary application distributions.
use super::binaries_extractor::{
  extract_tar_bz2, extract_tar_bz2_bundle, extract_zip, extract_zip_bundle,
  hoist_bundle_contents_into_bin,
};
use super::resolver::{self, DependencySettings, Discovery, Resolver, Source, Status};
use super::{installer, runtime};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc,
};
use std::time::Duration;

type Error = Box<dyn std::error::Error + Send + Sync>;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Input {
  platform: String,
  assets_root: PathBuf,
  tools: BTreeMap<String, Tool>,
}
#[derive(Deserialize)]
struct Tool {
  version: String,
  files: BTreeMap<String, Asset>,
}
#[derive(Deserialize)]
struct Asset {
  url: String,
  sha256: String,
  entry: Option<String>,
  bundle: Option<Bundle>,
}
#[derive(Deserialize)]
struct Bundle {
  folder_name: Option<String>,
  entry: String,
  rename_entry_to: Option<String>,
}
fn require(condition: bool, message: impl Into<String>) -> Result<(), Error> {
  if condition {
    Ok(())
  } else {
    Err(std::io::Error::other(message.into()).into())
  }
}
fn checked(report: &mut Value, name: &str) {
  report["checks"].as_array_mut().unwrap().push(json!(name));
  println!("PASS: {name}");
}
fn executable(path: &Path) -> Result<(), Error> {
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))?;
  }
  let _ = path;
  Ok(())
}
fn machine(path: &Path) -> Result<String, Error> {
  let bytes = std::fs::read(path)?;
  if bytes.starts_with(b"MZ") && bytes.len() >= 64 {
    let offset = u32::from_le_bytes(bytes[60..64].try_into()?) as usize;
    require(
      bytes.get(offset..offset + 4) == Some(b"PE\0\0"),
      "invalid PE header",
    )?;
    return Ok(
      match u16::from_le_bytes(bytes[offset + 4..offset + 6].try_into()?) {
        0x8664 => "x86_64",
        0xaa64 => "aarch64",
        _ => "unknown",
      }
      .into(),
    );
  }
  if bytes.starts_with(b"\x7fELF") && bytes.len() >= 20 {
    let pair = bytes[18..20].try_into()?;
    let code = if bytes[5] == 1 {
      u16::from_le_bytes(pair)
    } else {
      u16::from_be_bytes(pair)
    };
    return Ok(
      match code {
        62 => "x86_64",
        183 => "aarch64",
        _ => "unknown",
      }
      .into(),
    );
  }
  if bytes.len() >= 8 {
    let magic = u32::from_be_bytes(bytes[..4].try_into()?);
    if magic == 0xcafebabe || magic == 0xcafebabf {
      let count = u32::from_be_bytes(bytes[4..8].try_into()?);
      let size = if magic == 0xcafebabe { 20 } else { 32 };
      let mut architectures = Vec::new();
      for i in 0..count as usize {
        let offset = 8 + i * size;
        let cpu = u32::from_be_bytes(bytes[offset..offset + 4].try_into()?);
        architectures.push(match cpu {
          0x01000007 => "x86_64",
          0x0100000c => "aarch64",
          _ => "unknown",
        });
      }
      return Ok(architectures.join("+"));
    }
    let cpu = if magic == 0xcffaedfe || magic == 0xcefaedfe {
      u32::from_le_bytes(bytes[4..8].try_into()?)
    } else {
      u32::from_be_bytes(bytes[4..8].try_into()?)
    };
    return Ok(
      match cpu {
        0x01000007 => "x86_64",
        0x0100000c => "aarch64",
        _ => "unknown",
      }
      .into(),
    );
  }
  Err("unrecognized executable architecture".into())
}

/// Read the complete request before closing the response. Closing a socket with
/// unread request bytes can reset the connection on Windows (WSAECONNABORTED).
fn serve_http(stream: &mut TcpStream, data: &[u8]) -> std::io::Result<()> {
  // Windows accepts inherit the listener's nonblocking mode. Timeouts only
  // bound blocking reads; reset the mode before waiting for request bytes.
  stream.set_nonblocking(false)?;
  stream.set_read_timeout(Some(Duration::from_secs(2)))?;
  stream.set_write_timeout(Some(Duration::from_secs(2)))?;
  let mut request = Vec::new();
  let mut chunk = [0u8; 1024];
  while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
    if request.len() >= 8192 {
      return Err(std::io::Error::other(
        "HTTP fixture request headers too large",
      ));
    }
    let count = stream.read(&mut chunk)?;
    if count == 0 {
      return Err(std::io::Error::new(
        std::io::ErrorKind::UnexpectedEof,
        "incomplete HTTP request",
      ));
    }
    request.extend_from_slice(&chunk[..count]);
  }
  let header = format!(
    "HTTP/1.1 200 OK\r\nContent-Type: audio/mp4\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
    data.len()
  );
  stream.write_all(header.as_bytes())?;
  if !request.starts_with(b"HEAD ") {
    stream.write_all(data)?;
  }
  stream.flush()?;
  // The client can close as soon as Content-Length bytes arrive. Darwin can
  // reject shutdown/timeout changes on that closed socket with EINVAL. The
  // response has already been flushed, so this drain is best-effort cleanup.
  if stream.shutdown(Shutdown::Write).is_ok()
    && stream
      .set_read_timeout(Some(Duration::from_millis(250)))
      .is_ok()
  {
    while matches!(stream.read(&mut chunk), Ok(count) if count > 0) {}
  }
  Ok(())
}

pub async fn run(input: &Path, root: &Path, output: &Path) -> Result<(), Error> {
  let mut report = json!({"os": std::env::consts::OS, "arch": std::env::consts::ARCH,
    "status": "failed", "checks": [], "assets": [], "guiExercised": false});
  std::fs::create_dir_all(root)?;
  let root = root.canonicalize()?;
  report["sourceCommit"] = json!(option_env!("GITHUB_SHA"));
  report["appVersion"] = json!(env!("CARGO_PKG_VERSION"));
  let result = run_checks(input, &root, &mut report).await;
  match &result {
    Ok(()) => {
      let incomplete = report["assets"].as_array().unwrap().iter().any(|asset| {
        asset["status"] == "unavailable" || asset["status"] == "rejected-incompatible"
      });
      report["status"] = json!(if incomplete { "partial" } else { "passed" });
    }
    Err(error) => report["error"] = json!(error.to_string()),
  }
  if let Some(parent) = output.parent() {
    std::fs::create_dir_all(parent)?;
  }
  std::fs::write(output, serde_json::to_vec_pretty(&report)?)?;
  result
}

async fn run_checks(input: &Path, root: &Path, report: &mut Value) -> Result<(), Error> {
  let input: Input = serde_json::from_slice(&std::fs::read(input)?)?;
  let os = if cfg!(target_os = "macos") {
    "darwin"
  } else {
    std::env::consts::OS
  };
  let platform = format!("{os}-{}", std::env::consts::ARCH);
  require(
    input.platform == platform,
    format!("native runner mismatch: {platform} != {}", input.platform),
  )?;
  report["platform"] = json!(platform);
  checked(
    report,
    "native Rust execution matches requested OS/architecture",
  );
  std::fs::create_dir_all(root)?;
  let managed = root.join("application data ü/bin");
  std::fs::create_dir_all(&managed)?;
  let mut available = Vec::new();
  for name in resolver::TOOLS {
    let info = input
      .tools
      .get(name)
      .ok_or("tool absent from signed manifest")?;
    let Some(key) = resolver::asset_platform(name, &platform, |key| info.files.contains_key(key))
    else {
      require(
        name == "AtomicParsley",
        format!("no managed {name} asset for {platform}"),
      )?;
      report["assets"].as_array_mut().unwrap().push(json!({"tool":name,"status":"unavailable","reason":"no architecture-specific managed asset"}));
      continue;
    };
    let asset = &info.files[key];
    let filename = asset
      .url
      .rsplit('/')
      .next()
      .ok_or("asset filename missing")?;
    let source = input.assets_root.join(name).join(filename);
    require(
      hex::encode(Sha256::digest(std::fs::read(&source)?)) == asset.sha256.to_lowercase(),
      format!("{name}: asset hash mismatch"),
    )?;
    let staging = root.join(format!("staging-{name}"));
    std::fs::create_dir_all(&staging)?;
    let archive = staging.join(filename);
    std::fs::copy(source, &archive)?;
    let canonical = staging.join(resolver::executable_name(name));
    let extension = archive.extension().and_then(|s| s.to_str()).unwrap_or("");
    if let Some(bundle) = &asset.bundle {
      let (directory, _) = if extension == "zip" {
        extract_zip_bundle(
          &archive,
          &staging,
          bundle.folder_name.as_deref(),
          Path::new(&bundle.entry),
          bundle.rename_entry_to.as_deref(),
        )
        .await?
      } else {
        extract_tar_bz2_bundle(
          &archive,
          &staging,
          bundle.folder_name.as_deref(),
          Path::new(&bundle.entry),
          bundle.rename_entry_to.as_deref(),
        )
        .await?
      };
      std::fs::remove_file(&archive)?;
      hoist_bundle_contents_into_bin(&directory, &canonical).await?;
    } else if extension == "zip" {
      extract_zip(
        name,
        canonical.clone(),
        &archive,
        &staging,
        asset.entry.as_deref(),
      )
      .await?;
      std::fs::remove_file(&archive)?;
    } else if extension == "bz2" {
      extract_tar_bz2(
        name,
        canonical.clone(),
        &archive,
        &staging,
        asset.entry.as_deref(),
      )
      .await?;
      std::fs::remove_file(&archive)?;
    } else {
      installer::rename_if_needed(&archive, &canonical).await?;
    }
    executable(&canonical)?;
    let architecture = machine(&canonical)?;
    let native = architecture
      .split('+')
      .any(|arch| arch == std::env::consts::ARCH);
    let translated = !native
      && architecture == "x86_64"
      && std::env::consts::ARCH == "aarch64"
      && (cfg!(windows) || (cfg!(target_os = "macos") && name == "AtomicParsley"));
    if !native && !translated && name == "AtomicParsley" {
      // Optional tool: keep a bad signed asset visible and prove that production
      // validation rejects it. Do not replace its hash or claim it is compatible.
      let rejected = Resolver::default()
        .resolve(&Discovery {
          bin_dir: staging.clone(),
          search_dirs: Vec::new(),
          configured: Default::default(),
          locked: true,
        })
        .await;
      let dependency = rejected.iter().find(|r| r.tool == name).unwrap();
      require(
        dependency.active.is_none(),
        "wrong-architecture AtomicParsley unexpectedly validated",
      )?;
      report["assets"].as_array_mut().unwrap().push(json!({
        "tool": name, "status": "rejected-incompatible", "selectedPlatform": key,
        "binaryArchitecture": architecture, "url": asset.url, "sha256": asset.sha256,
        "diagnostics": dependency.diagnostics,
        "reason": "optional signed asset does not support this runner architecture"
      }));
      println!("PARTIAL: optional {name} asset is {architecture}, incompatible with {platform}");
      std::fs::remove_dir_all(staging)?;
      continue;
    }
    require(
      native || translated,
      format!("{name}: unexpected architecture {architecture} on {platform}"),
    )?;
    // Match the manager's validate-before-publication ordering, including the
    // Windows executable lock that running an extracted bundle can leave briefly.
    let staged = Resolver::default()
      .resolve(&Discovery {
        bin_dir: staging.clone(),
        search_dirs: Vec::new(),
        configured: Default::default(),
        locked: true,
      })
      .await;
    require(
      staged.iter().any(|r| r.tool == name && r.active.is_some()),
      format!("{name}: staged executable validation failed: {staged:?}"),
    )?;
    installer::publish(&staging, &managed).await?;
    report["assets"].as_array_mut().unwrap().push(json!({"tool":name,"manifestVersion":info.version,"selectedPlatform":key,"binaryArchitecture":architecture,"executionMode":if native {"native"} else {"OS translation"},"url":asset.url,"sha256":asset.sha256}));
    available.push(name);
  }
  let discovery = Discovery {
    bin_dir: managed.clone(),
    search_dirs: Vec::new(),
    configured: Default::default(),
    locked: false,
  };
  let mut resolver = Resolver::default();
  let reports = resolver.resolve(&discovery).await;
  report["managedReports"] = serde_json::to_value(&reports)?;
  for name in &available {
    require(
      reports.iter().any(|r| {
        r.tool == *name
          && r
            .active
            .as_ref()
            .is_some_and(|a| a.source == Source::Managed)
      }),
      format!("{name}: managed validation failed: {reports:?}"),
    )?;
  }
  checked(
    report,
    "real signed assets extracted, published, version/capability validated",
  );
  let empty = root.join("empty-managed");
  std::fs::create_dir_all(&empty)?;
  let previous_path = std::env::var_os("PATH").unwrap_or_default();
  let mut paths = vec![managed.clone()];
  paths.extend(std::env::split_paths(&previous_path));
  std::env::set_var("PATH", std::env::join_paths(paths)?);
  let system_discovery = Discovery::from_environment(empty, Default::default(), false);
  let system = resolver.resolve(&system_discovery).await;
  std::env::set_var("PATH", previous_path);
  for name in &available {
    require(
      system.iter().any(|r| {
        r.tool == *name
          && r
            .active
            .as_ref()
            .is_some_and(|a| a.source == Source::System && a.path.starts_with(&managed))
      }),
      format!("{name}: PATH discovery did not select the seeded native installation"),
    )?;
  }
  report["systemReports"] = serde_json::to_value(&system)?;
  checked(
    report,
    "actual PATH discovery uses seeded system tools without managed downloads",
  );
  let bad = root.join("invalid-system");
  std::fs::create_dir_all(&bad)?;
  let invalid = bad.join(resolver::executable_name("yt-dlp"));
  std::fs::write(&invalid, b"not an executable\n")?;
  executable(&invalid)?;
  let fallback = Discovery {
    search_dirs: vec![bad],
    ..discovery.clone()
  };
  let rejected = resolver.resolve(&fallback).await;
  let ytdlp = rejected.iter().find(|r| r.tool == "yt-dlp").unwrap();
  require(
    ytdlp
      .active
      .as_ref()
      .is_some_and(|a| a.source == Source::Managed)
      && !ytdlp.diagnostics.is_empty(),
    "invalid system executable did not fall back to managed yt-dlp",
  )?;
  let mut pinned = fallback.clone();
  pinned
    .configured
    .paths
    .insert("yt-dlp".into(), invalid.to_string_lossy().into_owned());
  let pinned_reports = resolver.resolve(&pinned).await;
  require(
    pinned_reports
      .iter()
      .any(|r| r.tool == "yt-dlp" && r.status == Status::ConfiguredInvalid && r.active.is_none()),
    "invalid configured path did not fail closed",
  )?;
  checked(
    report,
    "invalid system executable falls back; invalid explicit pin fails closed",
  );
  let locked = Discovery {
    locked: true,
    ..pinned
  };
  require(
    resolver.resolve(&locked).await.iter().any(|r| {
      r.tool == "yt-dlp"
        && r
          .active
          .as_ref()
          .is_some_and(|a| a.source == Source::Bundled)
    }),
    "locked distribution did not ignore invalid external pin",
  )?;
  checked(report, "locked bundled resolution ignores external pins");
  let mut split = Discovery {
    configured: DependencySettings::default(),
    ..discovery
  };
  for tool in ["ffmpeg", "ffprobe"] {
    let dir = root.join(format!("split {tool}"));
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(resolver::executable_name(tool));
    std::fs::copy(managed.join(resolver::executable_name(tool)), &path)?;
    executable(&path)?;
    split
      .configured
      .paths
      .insert(tool.into(), path.to_string_lossy().into_owned());
  }
  let split_reports = resolver.resolve(&split).await;
  let runtime = runtime::prepare(&split_reports, &root.join("aliases ü")).await?;
  let sample = root.join("sample.m4a");
  let mut encode = Command::new(runtime.ffmpeg_dir.join(resolver::executable_name("ffmpeg")));
  encode
    .args([
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440",
      "-t",
      "0.25",
      "-c:a",
      "aac",
      "-y",
    ])
    .arg(&sample);
  resolver::probe_command(encode, Duration::from_secs(30))?;
  let data = std::fs::read(&sample)?;
  let listener = TcpListener::bind("127.0.0.1:0")?;
  let url = format!("http://{}/sample.m4a", listener.local_addr()?);
  listener.set_nonblocking(true)?;
  let stop = Arc::new(AtomicBool::new(false));
  let thread_stop = stop.clone();
  let server = std::thread::spawn(move || {
    while !thread_stop.load(Ordering::Relaxed) {
      if let Ok((mut stream, _)) = listener.accept() {
        if let Err(error) = serve_http(&mut stream, &data) {
          eprintln!("local HTTP fixture: {error}");
        }
      } else {
        std::thread::sleep(Duration::from_millis(10));
      }
    }
  });
  let converted = root.join("converted.%(ext)s");
  let args = vec![
    "--ignore-config",
    "--no-cache-dir",
    "--no-playlist",
    "--no-progress",
    "--force-generic-extractor",
    "-x",
    "--audio-format",
    "mp3",
    "-o",
    converted.to_str().ok_or("output path is not UTF-8")?,
    &url,
  ]
  .into_iter()
  .map(str::to_string)
  .collect::<Vec<_>>();
  let download = resolver::probe_command(runtime.command(&args), Duration::from_secs(60));
  stop.store(true, Ordering::Relaxed);
  let _ = server.join();
  download?;
  let mut probe = Command::new(
    runtime
      .ffmpeg_dir
      .join(resolver::executable_name("ffprobe")),
  );
  probe
    .args([
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "json",
    ])
    .arg(root.join("converted.mp3"));
  let metadata: Value =
    serde_json::from_str(&resolver::probe_command(probe, Duration::from_secs(15))?)?;
  require(
    metadata["streams"]
      .as_array()
      .is_some_and(|streams| streams.iter().any(|s| s["codec_name"] == "mp3")),
    "FFprobe did not identify converted MP3",
  )?;
  report["convertedMedia"] = metadata;
  checked(
    report,
    "split FFmpeg/FFprobe aliasing, real local yt-dlp download and AAC-to-MP3 conversion",
  );
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn http_fixture_handles_nonblocking_accepted_sockets_and_fragmented_headers() {
    for method in ["GET", "HEAD"] {
      let listener = TcpListener::bind("127.0.0.1:0").unwrap();
      let address = listener.local_addr().unwrap();
      let server = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        // Windows inherits the nonblocking listener mode on accepted sockets.
        // Set it explicitly so every host reproduces that behavior.
        stream.set_nonblocking(true).unwrap();
        serve_http(&mut stream, b"media").unwrap();
      });
      let mut client = TcpStream::connect(address).unwrap();
      client
        .set_read_timeout(Some(Duration::from_millis(50)))
        .unwrap();
      write!(client, "{method} /sample.m4a HTTP/1.1\r\n").unwrap();
      let mut byte = [0u8];
      let error = client.read(&mut byte).unwrap_err();
      assert!(matches!(
        error.kind(),
        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
      ));
      client
        .write_all(b"Host: localhost\r\nConnection: close\r\n\r\n")
        .unwrap();
      client
        .set_read_timeout(Some(Duration::from_secs(3)))
        .unwrap();
      let mut response = Vec::new();
      client.read_to_end(&mut response).unwrap();
      let response = String::from_utf8(response).unwrap();
      assert!(response.contains("Content-Length: 5\r\n"));
      let body = response.split_once("\r\n\r\n").unwrap().1;
      assert_eq!(body, if method == "GET" { "media" } else { "" });
      drop(client);
      server.join().unwrap();
    }
  }
}
