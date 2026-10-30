//! Shared managed-download integrity and rollback primitives. These never receive
//! system executable paths: only app-owned staging and managed directories.
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::io::AsyncWriteExt;

type InstallError = Box<dyn std::error::Error + Send + Sync>;

/// Windows scanners and recently exited validation processes can temporarily
/// deny renames. Retry only those Windows lock errors, with a bounded deadline.
fn rename_managed(source: &Path, destination: &Path) -> std::io::Result<()> {
  #[cfg(not(windows))]
  let result = std::fs::rename(source, destination);
  #[cfg(windows)]
  let result = {
    let started = std::time::Instant::now();
    loop {
      match std::fs::rename(source, destination) {
        Err(error)
          if matches!(error.raw_os_error(), Some(5 | 32 | 33))
            && started.elapsed() < std::time::Duration::from_secs(5) =>
        {
          std::thread::sleep(std::time::Duration::from_millis(50));
        }
        result => break result,
      }
    }
  };
  result.map_err(|error| {
    std::io::Error::new(
      error.kind(),
      format!(
        "Unable to move {} to {}: {error}",
        source.display(),
        destination.display()
      ),
    )
  })
}

/// A direct download may already have the executable's canonical name.
pub async fn rename_if_needed(source: &Path, destination: &Path) -> std::io::Result<()> {
  if source != destination {
    let source = source.to_path_buf();
    let destination = destination.to_path_buf();
    tokio::task::spawn_blocking(move || rename_managed(&source, &destination))
      .await
      .map_err(std::io::Error::other)??;
  }
  Ok(())
}

pub async fn download_verified(
  client: &reqwest::Client,
  url: &str,
  expected: &str,
  destination: &Path,
  progress: impl Fn(u64, u64),
) -> Result<(), InstallError> {
  let temporary = destination.with_extension("download");
  let result = async {
    let mut response = client.get(url).send().await?.error_for_status()?;
    let total = response.content_length().unwrap_or(0);
    let mut received = 0;
    let mut file = tokio::fs::File::create(&temporary).await?;
    let mut hash = Sha256::new();
    while let Some(chunk) = response.chunk().await? {
      received += chunk.len() as u64;
      hash.update(&chunk);
      file.write_all(&chunk).await?;
      progress(received, total);
    }
    if hex::encode(hash.finalize()) != expected.to_ascii_lowercase() {
      return Err("sha256 mismatch".into());
    }
    file.flush().await?;
    drop(file); // Close before rename on Windows.
    rename_if_needed(&temporary, destination).await?;
    Ok(())
  }
  .await;
  if result.is_err() {
    let _ = tokio::fs::remove_file(&temporary).await;
  }
  result
}

/// Publish complete top-level bundle entries using same-filesystem renames.
/// Retain old entries until every new entry is in place; roll back on failure.
/// Multi-file bundles have a short publication window, serialized by the manager.
pub async fn publish(staging: &Path, bin: &Path) -> Result<(), InstallError> {
  let staging = staging.to_path_buf();
  let bin = bin.to_path_buf();
  tokio::task::spawn_blocking(move || {
    let backup = bin.join(format!(".backup-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&backup)?;
    let mut published = Vec::new();
    let mut saved = Vec::new();
    let result = (|| -> Result<(), InstallError> {
      for entry in std::fs::read_dir(&staging)? {
        let entry = entry?;
        let name = entry.file_name();
        let target = bin.join(&name);
        if target.exists() {
          rename_managed(&target, &backup.join(&name))?;
          saved.push(name.clone());
        }
        rename_managed(&entry.path(), &target)?;
        published.push(name);
      }
      Ok(())
    })();
    if result.is_err() {
      for name in &published {
        let target = bin.join(name);
        if target.is_dir() {
          std::fs::remove_dir_all(target)?;
        } else {
          std::fs::remove_file(target)?;
        }
      }
      for name in &saved {
        rename_managed(&backup.join(name), &bin.join(name))?;
      }
    }
    let _ = std::fs::remove_dir_all(&backup);
    if result.is_ok() {
      let _ = std::fs::remove_dir_all(&staging);
    }
    result
  })
  .await?
}

#[cfg(test)]
mod tests {
  #[cfg(windows)]
  #[tokio::test]
  async fn validated_ytdlp_is_publishable() {
    use crate::binaries::resolver::{Discovery, Resolver};
    use std::path::Path;
    let Some(source) = std::env::var_os("OVD_TEST_YTDLP_ARCHIVE") else {
      return;
    };
    let root = std::env::temp_dir().join(format!("ovd-ytdlp-test-{}", uuid::Uuid::new_v4()));
    let staging = root.join("staging");
    let bin = root.join("bin");
    std::fs::create_dir_all(&staging).unwrap();
    std::fs::create_dir_all(&bin).unwrap();
    use crate::binaries::binaries_extractor::{extract_zip_bundle, hoist_bundle_contents_into_bin};
    let archive = staging.join("yt-dlp_win.zip");
    std::fs::copy(source, &archive).unwrap();
    let (bundle, _) = extract_zip_bundle(
      &archive,
      &staging,
      Some("yt-dlp"),
      Path::new("yt-dlp.exe"),
      Some("yt-dlp.exe"),
    )
    .await
    .unwrap();
    std::fs::remove_file(archive).unwrap();
    hoist_bundle_contents_into_bin(&bundle, &staging.join("yt-dlp.exe"))
      .await
      .unwrap();
    let reports = Resolver::default()
      .resolve(&Discovery {
        bin_dir: staging.clone(),
        search_dirs: Vec::new(),
        configured: Default::default(),
        locked: true,
      })
      .await;
    let report = reports
      .iter()
      .find(|report| report.tool == "yt-dlp")
      .unwrap();
    assert!(report.active.is_some(), "{report:?}");
    super::publish(&staging, &bin).await.unwrap();
    let published = Resolver::default()
      .resolve(&Discovery {
        bin_dir: bin.clone(),
        search_dirs: Vec::new(),
        configured: Default::default(),
        locked: true,
      })
      .await;
    let report = published
      .iter()
      .find(|report| report.tool == "yt-dlp")
      .unwrap();
    assert!(report.active.is_some(), "{report:?}");
    std::fs::remove_dir_all(root).unwrap();
  }

  #[cfg(windows)]
  #[tokio::test]
  async fn publication_waits_for_a_windows_file_lock() {
    use std::os::windows::fs::OpenOptionsExt;
    let root = std::env::temp_dir().join(format!("ovd-lock-test-{}", uuid::Uuid::new_v4()));
    let staging = root.join("staging");
    let bin = root.join("bin");
    std::fs::create_dir_all(&staging).unwrap();
    std::fs::create_dir_all(&bin).unwrap();
    let executable = staging.join("yt-dlp.exe");
    std::fs::write(&executable, b"new executable").unwrap();
    let lock = std::fs::OpenOptions::new()
      .read(true)
      .share_mode(0)
      .open(&executable)
      .unwrap();
    let release = std::thread::spawn(move || {
      std::thread::sleep(std::time::Duration::from_millis(250));
      drop(lock);
    });
    super::publish(&staging, &bin).await.unwrap();
    release.join().unwrap();
    assert_eq!(
      std::fs::read(bin.join("yt-dlp.exe")).unwrap(),
      b"new executable"
    );
    std::fs::remove_dir_all(root).unwrap();
  }

  #[cfg(windows)]
  #[tokio::test]
  async fn publication_restores_existing_tool_when_replacement_fails() {
    use std::os::windows::fs::OpenOptionsExt;
    let root = std::env::temp_dir().join(format!("ovd-rollback-test-{}", uuid::Uuid::new_v4()));
    let staging = root.join("staging");
    let bin = root.join("bin");
    std::fs::create_dir_all(&staging).unwrap();
    std::fs::create_dir_all(&bin).unwrap();
    std::fs::write(staging.join("yt-dlp.exe"), b"replacement").unwrap();
    std::fs::write(bin.join("yt-dlp.exe"), b"previous").unwrap();
    let lock = std::fs::OpenOptions::new()
      .read(true)
      .share_mode(0)
      .open(staging.join("yt-dlp.exe"))
      .unwrap();
    let error = super::publish(&staging, &bin)
      .await
      .unwrap_err()
      .to_string();
    assert!(error.contains("Unable to move"));
    assert!(error.contains("yt-dlp.exe"));
    assert_eq!(std::fs::read(bin.join("yt-dlp.exe")).unwrap(), b"previous");
    drop(lock);
    std::fs::remove_dir_all(root).unwrap();
  }

  #[tokio::test]
  async fn direct_download_with_canonical_name_is_kept_in_place() {
    let dir = std::env::temp_dir().join(format!("ovd-rename-test-{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir(&dir).await.unwrap();
    let path = dir.join("yt-dlp.exe");
    tokio::fs::write(&path, b"executable").await.unwrap();
    super::rename_if_needed(&path, &path).await.unwrap();
    assert_eq!(tokio::fs::read(&path).await.unwrap(), b"executable");
    let renamed = dir.join("renamed.exe");
    super::rename_if_needed(&path, &renamed).await.unwrap();
    assert_eq!(tokio::fs::read(&renamed).await.unwrap(), b"executable");
    tokio::fs::remove_dir_all(dir).await.unwrap();
  }
}
