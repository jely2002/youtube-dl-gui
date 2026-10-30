use super::*;
use std::fs;
use std::sync::{Arc, OnceLock};

struct Fixture {
  root: PathBuf,
}
impl Fixture {
  fn new() -> Self {
    let root = std::env::temp_dir().join(format!("ovd test ü-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    Self { root }
  }
  fn tool(&self, directory: &str, tool: &str, version: &str, mode: &str, abi: u32) -> PathBuf {
    let dir = self.root.join(directory);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join(executable_name(tool));
    let mut bytes = fs::read(fixture_binary()).unwrap();
    let marker = b"OVD_FIXTURE_CONFIG\n";
    let offset = bytes
      .windows(marker.len())
      .position(|w| w == marker)
      .expect("fixture configuration section")
      + marker.len();
    let configuration = format!("{tool}\n{version}\n{mode}\n{abi}\n");
    bytes[offset..offset + configuration.len()].copy_from_slice(configuration.as_bytes());
    fs::write(&path, bytes).unwrap();
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    }
    #[cfg(target_os = "macos")]
    assert!(Command::new("/usr/bin/codesign")
      .args(["--force", "--sign", "-"])
      .arg(&path)
      .status()
      .unwrap()
      .success());
    path
  }
  fn discovery(&self) -> Discovery {
    Discovery {
      bin_dir: self.root.join("managed"),
      search_dirs: vec![self.root.join("system")],
      configured: DependencySettings::default(),
      locked: false,
    }
  }
  fn complete(&self, dir: &str) {
    for (tool, version) in [
      ("yt-dlp", "2026.01.01"),
      ("ffmpeg", "6.1.1"),
      ("ffprobe", "6.1.1"),
      ("deno", "2.5.0"),
      ("AtomicParsley", "20240608.083822.1ed9031"),
    ] {
      self.tool(dir, tool, version, "ok", 60);
    }
  }
}
impl Drop for Fixture {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.root);
  }
}

fn fixture_binary() -> &'static PathBuf {
  static BINARY: OnceLock<PathBuf> = OnceLock::new();
  BINARY.get_or_init(|| {
    let root = std::env::temp_dir().join(format!("ovd-fixture-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let source = root.join("main.rs");
    fs::write(&source, include_str!("fixture.rs.txt")).unwrap();
    let binary = root.join(executable_name("fixture"));
    let output = Command::new("rustc")
      .arg("--edition=2021")
      .arg(&source)
      .arg("-o")
      .arg(&binary)
      .output()
      .expect("rustc must be available in the test toolchain");
    assert!(
      output.status.success(),
      "{}",
      String::from_utf8_lossy(&output.stderr)
    );
    binary
  })
}
fn active<'a>(reports: &'a [DependencyReport], name: &str) -> &'a ResolvedDependency {
  reports
    .iter()
    .find(|r| r.tool == name)
    .unwrap()
    .active
    .as_ref()
    .unwrap_or_else(|| panic!("{name}: {reports:#?}"))
}
fn report<'a>(reports: &'a [DependencyReport], name: &str) -> &'a DependencyReport {
  reports.iter().find(|r| r.tool == name).unwrap()
}

#[tokio::test]
async fn system_tools_take_precedence_over_existing_managed_tools() {
  let f = Fixture::new();
  f.complete("system");
  f.complete("managed");
  let reports = Resolver::default().resolve(&f.discovery()).await;
  for tool in TOOLS {
    assert_eq!(active(&reports, tool).source, Source::System);
  }
}

#[tokio::test]
async fn missing_path_tools_use_managed_without_a_manifest_or_network() {
  let f = Fixture::new();
  f.complete("managed");
  let reports = Resolver::default().resolve(&f.discovery()).await;
  for tool in TOOLS {
    assert_eq!(active(&reports, tool).source, Source::Managed);
  }
}

#[tokio::test]
async fn completely_missing_tools_require_individual_installation() {
  let f = Fixture::new();
  f.tool("system", "deno", "2.5.0", "ok", 0);
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert!(!report(&reports, "deno").requires_install());
  assert!(report(&reports, "yt-dlp").requires_install());
}

#[tokio::test]
async fn configured_path_takes_precedence_and_can_be_renamed() {
  let f = Fixture::new();
  f.complete("system");
  let source = f.tool("custom", "deno", "2.6.0", "ok", 0);
  let renamed = source.with_file_name(executable_name("my runtime ü"));
  fs::rename(source, &renamed).unwrap();
  let mut d = f.discovery();
  d.configured
    .paths
    .insert("deno".into(), renamed.to_string_lossy().into());
  let reports = Resolver::default().resolve(&d).await;
  assert_eq!(active(&reports, "deno").path, renamed);
  assert_eq!(active(&reports, "deno").source, Source::Configured);
}

#[tokio::test]
async fn invalid_explicit_path_fails_closed_even_with_valid_system_and_managed() {
  let f = Fixture::new();
  f.complete("system");
  f.complete("managed");
  let mut d = f.discovery();
  d.configured
    .paths
    .insert("deno".into(), "relative/deno".into());
  let reports = Resolver::default().resolve(&d).await;
  assert_eq!(report(&reports, "deno").status, Status::ConfiguredInvalid);
  assert!(!report(&reports, "deno").requires_install());
}

#[tokio::test]
async fn incompatible_system_falls_back_and_preserves_reason() {
  let f = Fixture::new();
  f.tool("system", "deno", "1.0.0", "ok", 0);
  f.complete("managed");
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert_eq!(active(&reports, "deno").source, Source::Managed);
  assert!(report(&reports, "deno").diagnostics[0]
    .reason
    .contains("minimum"));
}

#[tokio::test]
async fn wrong_identity_and_launch_failure_are_distinct_from_compatible() {
  for (mode, expected) in [
    ("wrong", Status::Incompatible),
    ("fail", Status::UnableToExecute),
    ("no-capability", Status::Incompatible),
  ] {
    let f = Fixture::new();
    f.tool("system", "ffmpeg", "6.0.0", mode, 60);
    let reports = Resolver::default().resolve(&f.discovery()).await;
    assert!(
      report(&reports, "ffmpeg")
        .diagnostics
        .iter()
        .any(|d| d.status == expected),
      "expected {expected:?}: {reports:#?}"
    );
    assert!(report(&reports, "ffmpeg").active.is_none());
  }
}

#[test]
fn hung_executable_is_killed_with_bounded_wait() {
  let f = Fixture::new();
  let path = f.tool("system", "deno", "2.5.0", "hang", 0);
  let start = Instant::now();
  let error = probe(&path, &["--version"], Duration::from_millis(200)).unwrap_err();
  assert!(
    error.contains("timed out"),
    "unexpected validation error: {error}"
  );
  assert!(start.elapsed() < Duration::from_secs(3));
}

#[test]
fn excessive_output_is_bounded() {
  let f = Fixture::new();
  let path = f.tool("system", "deno", "2.5.0", "spam", 0);
  assert!(probe(&path, &["--version"], Duration::from_secs(2)).is_err());
}

#[tokio::test]
async fn ffmpeg_and_ffprobe_are_discovered_independently() {
  for present in ["ffmpeg", "ffprobe"] {
    let f = Fixture::new();
    f.tool("system", present, "6.1.1", "ok", 60);
    let reports = Resolver::default().resolve(&f.discovery()).await;
    assert_eq!(active(&reports, present).source, Source::System);
    let missing = if present == "ffmpeg" {
      "ffprobe"
    } else {
      "ffmpeg"
    };
    assert!(report(&reports, missing).requires_install());
  }
}

#[tokio::test]
async fn prefers_sibling_ffprobe_to_unrelated_path_candidate() {
  let f = Fixture::new();
  f.tool("system", "ffmpeg", "6.1.1", "ok", 60);
  let sibling = f.tool("system", "ffprobe", "6.1.1", "ok", 60);
  f.tool("first", "ffprobe", "7.0.0", "ok", 61);
  let mut d = f.discovery();
  d.search_dirs.insert(0, f.root.join("first"));
  let reports = Resolver::default().resolve(&d).await;
  assert_eq!(active(&reports, "ffprobe").path, sibling);
}

#[tokio::test]
async fn rejects_incoherent_ffmpeg_ffprobe_abi() {
  let f = Fixture::new();
  f.tool("system", "ffmpeg", "6.0.0", "ok", 60);
  f.tool("system", "ffprobe", "7.0.0", "ok", 61);
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert!(report(&reports, "ffprobe").active.is_none());
  assert!(report(&reports, "ffprobe")
    .diagnostics
    .iter()
    .any(|d| d.reason.contains("ABI")));
}

#[test]
fn compatible_older_versions_do_not_require_manifest_equality() {
  assert!(older_than("6.1.1-ubuntu", "v7.0.0"));
  assert!(!older_than("8.0.0", "v7.0.0"));
  assert!(older_than("2025.11.12", "2026.01.01"));
}

#[tokio::test]
async fn locked_layout_ignores_overrides_and_system_tools_without_writes() {
  let f = Fixture::new();
  f.complete("system");
  f.complete("managed");
  let mut d = f.discovery();
  d.locked = true;
  d.configured.paths.insert("deno".into(), "bad".into());
  let before = fs::read_dir(&d.bin_dir).unwrap().count();
  let reports = Resolver::default().resolve(&d).await;
  for tool in TOOLS {
    assert_eq!(active(&reports, tool).source, Source::Bundled);
  }
  assert_eq!(before, fs::read_dir(&d.bin_dir).unwrap().count());
}

#[tokio::test]
async fn portable_and_installed_roots_follow_same_resolution() {
  let f = Fixture::new();
  f.complete("ovd-portable/bin");
  f.complete("app-data/bin");
  for dir in ["ovd-portable/bin", "app-data/bin"] {
    let mut d = f.discovery();
    d.bin_dir = f.root.join(dir);
    let reports = Resolver::default().resolve(&d).await;
    assert!(active(&reports, "yt-dlp").path.starts_with(&d.bin_dir));
  }
}

#[test]
fn architecture_selection_never_guesses_and_preserves_documented_emulation() {
  assert_eq!(
    asset_platform("yt-dlp", "windows-aarch64", |k| k == "windows-x86_64"),
    None
  );
  assert_eq!(
    asset_platform("AtomicParsley", "windows-aarch64", |k| k
      == "windows-aarch64"),
    Some("windows-aarch64")
  );
  assert_eq!(
    asset_platform("AtomicParsley", "darwin-aarch64", |k| k == "darwin-x86_64"),
    Some("darwin-x86_64")
  );
  assert_eq!(
    asset_platform("AtomicParsley", "linux-aarch64", |k| k == "linux-x86_64"),
    None
  );
  assert_eq!(
    asset_platform("deno", "linux-aarch64", |k| k == "linux-aarch64"),
    Some("linux-aarch64")
  );
}

#[tokio::test]
async fn cache_invalidates_removed_modified_and_symlink_retargeted_tools() {
  let f = Fixture::new();
  let path = f.tool("system", "deno", "2.5.0", "ok", 0);
  let mut resolver = Resolver::default();
  let d = f.discovery();
  assert_eq!(active(&resolver.resolve(&d).await, "deno").version, "2.5.0");
  fs::remove_file(&path).unwrap();
  assert!(report(&resolver.resolve(&d).await, "deno").active.is_none());
  f.tool("system", "deno", "2.6.10", "ok", 0);
  assert_eq!(
    active(&resolver.resolve(&d).await, "deno").version,
    "2.6.10"
  );
}

#[cfg(unix)]
#[tokio::test]
async fn non_executable_file_is_not_treated_as_installed() {
  use std::os::unix::fs::PermissionsExt;
  let f = Fixture::new();
  let path = f.tool("system", "deno", "2.5.0", "ok", 0);
  fs::set_permissions(path, fs::Permissions::from_mode(0o644)).unwrap();
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert!(report(&reports, "deno").active.is_none());
  assert!(report(&reports, "deno").diagnostics[0]
    .reason
    .contains("executable"));
}

#[tokio::test]
async fn concurrent_checks_share_a_resolver_and_remain_consistent() {
  let f = Fixture::new();
  f.complete("system");
  let resolver = Arc::new(tokio::sync::Mutex::new(Resolver::default()));
  let mut tasks = Vec::new();
  for _ in 0..4 {
    let resolver = resolver.clone();
    let d = f.discovery();
    tasks.push(tokio::spawn(async move {
      resolver.lock().await.resolve(&d).await
    }));
  }
  for task in tasks {
    assert_eq!(active(&task.await.unwrap(), "deno").source, Source::System);
  }
}

#[tokio::test]
async fn runtime_command_uses_resolved_paths_with_spaces_unicode_and_literal_arguments() {
  let f = Fixture::new();
  f.complete("system");
  // Force a split FFmpeg/FFprobe installation, and manually renamed AtomicParsley.
  let moved = f.root.join("other tools");
  fs::create_dir_all(&moved).unwrap();
  fs::rename(
    f.root.join("system").join(executable_name("ffprobe")),
    moved.join(executable_name("ffprobe")),
  )
  .unwrap();
  let mut d = f.discovery();
  d.search_dirs.push(moved);
  let reports = Resolver::default().resolve(&d).await;
  let paths = crate::binaries::runtime::prepare(&reports, &f.root.join("runtime"))
    .await
    .unwrap();
  let output = paths
    .command(&[
      "--dump-test".into(),
      "https://example.test/?a=$(echo nope)&b=ü space".into(),
    ])
    .output()
    .unwrap();
  assert!(output.status.success());
  let output = String::from_utf8(output.stdout).unwrap();
  assert!(output.contains(&format!(
    "ARG=deno:{}",
    active(&reports, "deno").path.display()
  )));
  assert!(output.contains("ARG=--ffmpeg-location"));
  assert!(output.contains("ARG=https://example.test/?a=$(echo nope)&b=ü space"));
  for tool in ["ffmpeg", "ffprobe"] {
    let result = probe(
      &paths.ffmpeg_dir.join(executable_name(tool)),
      &["-version"],
      Duration::from_secs(2),
    )
    .unwrap();
    assert!(result.contains(&format!("{tool} version")));
  }
}

#[test]
fn search_paths_ignore_empty_and_relative_entries() {
  let input = if cfg!(windows) {
    ";relative;C:\\Program Files\\ü tools"
  } else {
    ":relative:/usr/bin:/opt/ü tools"
  };
  let dirs = search_directories(Some(input.into()));
  assert!(!dirs.is_empty());
  assert!(dirs.iter().all(|p| p.is_absolute()));
}

#[tokio::test]
async fn selects_existing_coherent_managed_pair_after_incompatible_system_pair() {
  let f = Fixture::new();
  f.complete("managed");
  f.tool("system", "ffmpeg", "7.0.0", "ok", 61);
  f.tool("system", "ffprobe", "8.0.0", "ok", 62);
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert_eq!(active(&reports, "ffmpeg").source, Source::Managed);
  assert_eq!(active(&reports, "ffprobe").source, Source::Managed);
}

#[tokio::test]
async fn upstream_nightly_ffmpeg_assets_are_validated_by_abi_and_capabilities() {
  let f = Fixture::new();
  f.tool("system", "ffmpeg", "N-123456-g123abc", "ok", 62);
  f.tool("system", "ffprobe", "N-123456-g123abc", "ok", 62);
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert_eq!(active(&reports, "ffmpeg").source, Source::System);
}

#[cfg(unix)]
#[tokio::test]
async fn cache_tracks_symlink_targets_and_permissions() {
  use std::os::unix::fs::{symlink, PermissionsExt};
  let f = Fixture::new();
  let first = f.tool("first", "deno", "2.5.0", "ok", 0);
  let second = f.tool("second", "deno", "2.6.0", "ok", 0);
  fs::create_dir_all(f.root.join("system")).unwrap();
  let link = f.root.join("system/deno");
  symlink(first, &link).unwrap();
  let mut resolver = Resolver::default();
  let d = f.discovery();
  assert_eq!(active(&resolver.resolve(&d).await, "deno").version, "2.5.0");
  fs::remove_file(&link).unwrap();
  symlink(&second, &link).unwrap();
  assert_eq!(active(&resolver.resolve(&d).await, "deno").version, "2.6.0");
  fs::set_permissions(second, fs::Permissions::from_mode(0o644)).unwrap();
  assert!(report(&resolver.resolve(&d).await, "deno").active.is_none());
}

#[tokio::test]
async fn arbitrary_or_wrong_os_files_do_not_pass_launch_validation() {
  let f = Fixture::new();
  fs::create_dir_all(f.root.join("system")).unwrap();
  let path = f.root.join("system").join(executable_name("deno"));
  fs::write(
    &path,
    b"MZ not a valid executable for this operating system",
  )
  .unwrap();
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
  }
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert!(report(&reports, "deno").active.is_none());
}

#[tokio::test]
async fn failed_download_and_hash_mismatch_preserve_existing_binary_then_recover() {
  use std::io::{Read, Write};
  use std::net::TcpListener;
  let f = Fixture::new();
  let destination = f.root.join("downloaded");
  fs::write(&destination, b"previous valid executable").unwrap();
  // Deterministic loopback HTTP responses, never a public service.
  let listener = TcpListener::bind("127.0.0.1:0").unwrap();
  let address = listener.local_addr().unwrap();
  let server = std::thread::spawn(move || {
    for response in [
      "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
      "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nnew",
      "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nnew",
    ] {
      let (mut stream, _) = listener.accept().unwrap();
      let mut request = [0; 2048];
      let _ = stream.read(&mut request);
      stream.write_all(response.as_bytes()).unwrap();
    }
  });
  let client = reqwest::Client::builder()
    .no_proxy()
    .timeout(Duration::from_secs(3))
    .build()
    .unwrap();
  let url = format!("http://{address}/tool");
  for _ in 0..2 {
    assert!(crate::binaries::installer::download_verified(
      &client,
      &url,
      "incorrect-hash",
      &destination,
      |_, _| {}
    )
    .await
    .is_err());
    assert_eq!(
      fs::read(&destination).unwrap(),
      b"previous valid executable"
    );
    assert!(!destination.with_extension("download").exists());
  }
  use sha2::Digest;
  let digest = hex::encode(sha2::Sha256::digest(b"new"));
  crate::binaries::installer::download_verified(&client, &url, &digest, &destination, |_, _| {})
    .await
    .unwrap();
  assert_eq!(fs::read(&destination).unwrap(), b"new");
  server.join().unwrap();
}

#[tokio::test]
async fn publication_keeps_other_managed_tools_and_bundle_contents() {
  let f = Fixture::new();
  let bin = f.root.join("bin");
  let staged = f.root.join("staged");
  fs::create_dir_all(&bin).unwrap();
  fs::create_dir_all(staged.join("_internal")).unwrap();
  fs::write(bin.join("deno"), b"keep").unwrap();
  fs::write(bin.join("yt-dlp"), b"old").unwrap();
  fs::write(staged.join("yt-dlp"), b"new").unwrap();
  fs::write(staged.join("_internal/runtime"), b"library").unwrap();
  crate::binaries::installer::publish(&staged, &bin)
    .await
    .unwrap();
  assert_eq!(fs::read(bin.join("deno")).unwrap(), b"keep");
  assert_eq!(fs::read(bin.join("yt-dlp")).unwrap(), b"new");
  assert!(bin.join("_internal/runtime").exists());
  assert!(!staged.exists());
}

#[tokio::test]
async fn manual_ffprobe_selection_discovers_ffmpeg_in_the_same_installation() {
  let f = Fixture::new();
  f.tool("custom", "ffmpeg", "6.1.1", "ok", 60);
  let probe = f.tool("custom", "ffprobe", "6.1.1", "ok", 60);
  let mut d = f.discovery();
  d.configured
    .paths
    .insert("ffprobe".into(), probe.to_string_lossy().into());
  let reports = Resolver::default().resolve(&d).await;
  assert_eq!(active(&reports, "ffprobe").source, Source::Configured);
  assert!(active(&reports, "ffmpeg")
    .path
    .starts_with(f.root.join("custom")));
}

#[tokio::test]
async fn missing_managed_fallback_does_not_hide_an_incompatible_system_diagnostic() {
  let f = Fixture::new();
  f.tool("system", "deno", "1.0.0", "ok", 0);
  let reports = Resolver::default().resolve(&f.discovery()).await;
  assert_eq!(report(&reports, "deno").status, Status::Incompatible);
}

#[cfg(target_os = "linux")]
#[test]
fn transient_executable_write_lock_does_not_reject_a_compatible_tool() {
  let f = Fixture::new();
  let path = f.tool("system", "deno", "2.5.0", "ok", 0);
  let writer = fs::OpenOptions::new().write(true).open(&path).unwrap();
  let holder = std::thread::spawn(move || {
    std::thread::sleep(Duration::from_millis(80));
    drop(writer);
  });
  let output = probe(&path, &["--version"], Duration::from_secs(2)).unwrap();
  holder.join().unwrap();
  assert!(output.contains("deno 2.5.0"));
}
