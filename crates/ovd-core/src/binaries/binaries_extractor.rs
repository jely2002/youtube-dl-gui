use std::error::Error;
use std::fmt;
use std::io;
use std::path::{Component, Path, PathBuf};

use bzip2::read::BzDecoder;
use tar::{Archive as TarArchive, EntryType as TarEntryType};
use tokio::task::JoinError;
use zip::ZipArchive;

#[derive(Debug)]
pub enum ExtractError {
  Io(io::Error),
  Zip(zip::result::ZipError),
  Join(JoinError),
  EntryNotFound {
    wanted: String,
    available: EntriesDisplay,
  },
  AmbiguousArchive(EntriesDisplay),
  PathTraversal(String),
  UnsupportedEntry(String),
}

#[derive(Clone, Debug)]
pub struct EntriesDisplay(pub Vec<String>);

impl fmt::Display for EntriesDisplay {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    const MAX: usize = 20;
    if self.0.len() > MAX {
      write!(f, "{:?} (and {} more…)", &self.0[..MAX], self.0.len() - MAX)
    } else {
      write!(f, "{:?}", self.0)
    }
  }
}

impl fmt::Display for ExtractError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::Io(e) => write!(f, "I/O error: {e}"),
      Self::Zip(e) => write!(f, "zip error: {e}"),
      Self::Join(e) => write!(f, "task join error: {e}"),
      Self::EntryNotFound { wanted, available } => {
        write!(f, "entry '{wanted}' not found. available: {available}")
      }
      Self::AmbiguousArchive(available) => {
        write!(
          f,
          "no entry provided and archive has multiple files. available: {available}"
        )
      }
      Self::PathTraversal(p) => write!(f, "archive contains path traversal: {p}"),
      Self::UnsupportedEntry(p) => write!(f, "unsupported archive entry: {p}"),
    }
  }
}

impl Error for ExtractError {
  fn source(&self) -> Option<&(dyn Error + 'static)> {
    match self {
      Self::Io(e) => Some(e),
      Self::Zip(e) => Some(e),
      Self::Join(e) => Some(e),
      _ => None,
    }
  }
}

impl From<io::Error> for ExtractError {
  fn from(e: io::Error) -> Self {
    Self::Io(e)
  }
}
impl From<zip::result::ZipError> for ExtractError {
  fn from(e: zip::result::ZipError) -> Self {
    Self::Zip(e)
  }
}
impl From<JoinError> for ExtractError {
  fn from(e: JoinError) -> Self {
    Self::Join(e)
  }
}

fn ensure_parent(path: &Path) -> io::Result<()> {
  if let Some(p) = path.parent() {
    std::fs::create_dir_all(p)?;
  }
  Ok(())
}

fn atomic_file_replace(tmp: &Path, dst: &Path) -> io::Result<()> {
  if dst.exists() {
    std::fs::remove_file(dst)?;
  }
  std::fs::rename(tmp, dst)
}

fn atomic_dir_replace(tmp_dir: &Path, dst_dir: &Path) -> io::Result<()> {
  if dst_dir.exists() {
    std::fs::remove_dir_all(dst_dir)?;
  }
  std::fs::rename(tmp_dir, dst_dir)
}

fn safe_join(root: &Path, candidate: &Path) -> Result<PathBuf, ExtractError> {
  let mut out = PathBuf::from(root);
  for comp in candidate.components() {
    match comp {
      Component::Normal(p) => out.push(p),
      Component::CurDir => {}
      Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
        return Err(ExtractError::PathTraversal(candidate.display().to_string()))
      }
    }
  }
  Ok(out)
}

fn zip_basename(name: &str) -> &str {
  name.rsplit('/').next().unwrap_or(name)
}

pub async fn extract_zip(
  tool: &str,
  canonical: PathBuf,
  archive: &Path,
  out_dir: &Path,
  entry: Option<&str>,
) -> Result<PathBuf, ExtractError> {
  let tool_name = tool.to_string();
  let archive = archive.to_owned();
  let out_dir = out_dir.to_owned();
  let entry = entry.map(str::to_owned);

  tokio::task::spawn_blocking(move || -> Result<PathBuf, ExtractError> {
    let file = std::fs::File::open(&archive)?;
    let mut zip = ZipArchive::new(file)?;

    let mut files = Vec::<(usize, String)>::with_capacity(zip.len());
    for i in 0..zip.len() {
      let e = zip.by_index(i)?;
      if e.is_file() {
        files.push((i, e.name().to_string()));
      }
    }
    let available = EntriesDisplay(files.iter().map(|(_, n)| n.clone()).collect());

    let chosen_index = if let Some(expect) = entry {
      if let Some((idx, _)) = files.iter().find(|(_, n)| n == &expect) {
        *idx
      } else {
        return Err(ExtractError::EntryNotFound {
          wanted: expect,
          available,
        });
      }
    } else if let Some((idx, _)) = files.iter().find(|(_, n)| zip_basename(n) == tool_name) {
      *idx
    } else if files.len() == 1 {
      files[0].0
    } else {
      return Err(ExtractError::AmbiguousArchive(available));
    };

    let mut e = zip.by_index(chosen_index)?;
    let base = {
      let b = zip_basename(e.name());
      if b.is_empty() {
        tool_name.as_str()
      } else {
        b
      }
    };

    let tmp_out = out_dir.join(format!("{base}.tmp"));
    ensure_parent(&tmp_out)?;
    {
      let mut outfile = std::fs::File::create(&tmp_out)?;
      std::io::copy(&mut e, &mut outfile)?;
    }
    atomic_file_replace(&tmp_out, &canonical)?;
    Ok(canonical)
  })
  .await?
}

pub async fn extract_tar_bz2(
  tool: &str,
  canonical: PathBuf,
  archive: &Path,
  out_dir: &Path,
  entry: Option<&str>,
) -> Result<PathBuf, ExtractError> {
  let tool_name = tool.to_string();
  let archive = archive.to_owned();
  let out_dir = out_dir.to_owned();
  let entry = entry.map(str::to_owned);

  tokio::task::spawn_blocking(move || -> Result<PathBuf, ExtractError> {
    let file = std::fs::File::open(&archive)?;
    let mut tar = TarArchive::new(BzDecoder::new(file));

    let mut files = Vec::<PathBuf>::new();
    for e in tar.entries()? {
      let e = e?;
      if e.header().entry_type().is_file() {
        files.push(e.path()?.into_owned());
      }
    }
    let available = EntriesDisplay(
      files
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect(),
    );

    let chosen_path = if let Some(expect) = entry {
      let expect_os = std::ffi::OsString::from(expect.clone());
      if let Some(p) = files.iter().find(|p| p.as_os_str() == expect_os) {
        p.clone()
      } else {
        return Err(ExtractError::EntryNotFound {
          wanted: expect,
          available,
        });
      }
    } else if let Some(p) = files.iter().find(|p| {
      p.file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n == tool_name)
    }) {
      p.clone()
    } else if files.len() == 1 {
      files.remove(0)
    } else {
      return Err(ExtractError::AmbiguousArchive(available));
    };

    let file = std::fs::File::open(&archive)?;
    let mut tar = TarArchive::new(BzDecoder::new(file));

    let base = chosen_path
      .file_name()
      .and_then(|n| n.to_str())
      .unwrap_or(tool_name.as_str());
    let tmp_out = out_dir.join(format!("{base}.tmp"));
    ensure_parent(&tmp_out)?;

    for e in tar.entries()? {
      let mut e = e?;
      if !e.header().entry_type().is_file() {
        continue;
      }
      if e.path()?.as_ref() == chosen_path {
        e.unpack(&tmp_out)?;
        atomic_file_replace(&tmp_out, &canonical)?;
        return Ok(canonical);
      }
    }

    Err(
      io::Error::new(
        io::ErrorKind::NotFound,
        "selected entry vanished during extraction",
      )
      .into(),
    )
  })
  .await?
}

pub async fn extract_zip_bundle(
  archive: &Path,
  out_parent: &Path,
  final_folder_name: Option<&str>,
  entry_relative: &Path,
  rename_entry_to: Option<&str>,
) -> Result<(PathBuf, PathBuf), ExtractError> {
  let archive = archive.to_owned();
  let out_parent = out_parent.to_owned();
  let final_folder_name = final_folder_name.map(str::to_string);
  let entry_relative = entry_relative.to_path_buf();
  let rename_entry_to = rename_entry_to.map(str::to_string);

  tokio::task::spawn_blocking(move || -> Result<(PathBuf, PathBuf), ExtractError> {
    let file = std::fs::File::open(&archive)?;
    let mut zip = ZipArchive::new(file)?;

    let temp_root = out_parent.join(format!(".extract-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_root)?;

    for i in 0..zip.len() {
      let mut e = zip.by_index(i)?;
      let entry_name = e.name();

      let rel_path = Path::new(entry_name);
      let out_path = safe_join(&temp_root, rel_path)?;

      if e.is_dir() {
        std::fs::create_dir_all(&out_path)?;
        continue;
      }
      ensure_parent(&out_path)?;
      let mut outfile = std::fs::File::create(&out_path)?;
      std::io::copy(&mut e, &mut outfile)?;
    }

    let extracted_root = detect_extracted_root(&temp_root)?;

    let final_dir = {
      let name = if let Some(name) = final_folder_name.clone() {
        name
      } else {
        extracted_root.file_name().map_or_else(
          || "bundle".to_string(),
          |n| n.to_string_lossy().into_owned(),
        )
      };
      out_parent.join(name)
    };

    atomic_dir_replace(&extracted_root, &final_dir)?;

    let entry_abs_initial = final_dir.join(&entry_relative);
    if !entry_abs_initial.exists() {
      return Err(ExtractError::EntryNotFound {
        wanted: entry_relative.to_string_lossy().into_owned(),
        available: list_tree(&final_dir, 200),
      });
    }

    let entry_abs = if let Some(new_name) = &rename_entry_to {
      let target = entry_abs_initial
        .parent()
        .map_or_else(|| final_dir.join(new_name), |p| p.join(new_name));
      std::fs::rename(&entry_abs_initial, &target)?;
      target
    } else {
      entry_abs_initial
    };

    Ok((final_dir, entry_abs))
  })
  .await?
}

pub async fn extract_tar_bz2_bundle(
  archive: &Path,
  out_parent: &Path,
  final_folder_name: Option<&str>,
  entry_relative: &Path,
  rename_entry_to: Option<&str>,
) -> Result<(PathBuf, PathBuf), ExtractError> {
  let archive = archive.to_owned();
  let out_parent = out_parent.to_owned();
  let final_folder_name = final_folder_name.map(str::to_string);
  let entry_relative = entry_relative.to_path_buf();
  let rename_entry_to = rename_entry_to.map(str::to_string);

  tokio::task::spawn_blocking(move || -> Result<(PathBuf, PathBuf), ExtractError> {
    let file = std::fs::File::open(&archive)?;
    let mut tar = TarArchive::new(BzDecoder::new(file));

    let temp_root = out_parent.join(format!(".extract-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_root)?;

    for entry in tar.entries()? {
      let mut entry = entry?;
      let path_in_tar = entry.path()?.into_owned();

      let out_path = safe_join(&temp_root, &path_in_tar)?;

      match entry.header().entry_type() {
        TarEntryType::Directory => {
          std::fs::create_dir_all(&out_path)?;
        }
        TarEntryType::Regular => {
          ensure_parent(&out_path)?;
          entry.unpack(&out_path)?;
        }
        other => {
          return Err(ExtractError::UnsupportedEntry(format!(
            "{} ({:?})",
            path_in_tar.display(),
            other
          )));
        }
      }
    }

    let extracted_root = detect_extracted_root(&temp_root)?;

    let final_dir = {
      let name = if let Some(name) = final_folder_name.clone() {
        name
      } else {
        extracted_root.file_name().map_or_else(
          || "bundle".to_string(),
          |n| n.to_string_lossy().into_owned(),
        )
      };
      out_parent.join(name)
    };

    atomic_dir_replace(&extracted_root, &final_dir)?;

    let entry_abs_initial = final_dir.join(&entry_relative);
    if !entry_abs_initial.exists() {
      return Err(ExtractError::EntryNotFound {
        wanted: entry_relative.to_string_lossy().into_owned(),
        available: list_tree(&final_dir, 200),
      });
    }

    let entry_abs = if let Some(new_name) = &rename_entry_to {
      let target = entry_abs_initial
        .parent()
        .map_or_else(|| final_dir.join(new_name), |p| p.join(new_name));
      std::fs::rename(&entry_abs_initial, &target)?;
      target
    } else {
      entry_abs_initial
    };

    Ok((final_dir, entry_abs))
  })
  .await?
}

fn detect_extracted_root(temp_root: &Path) -> Result<PathBuf, ExtractError> {
  let mut entries = Vec::new();
  for e in std::fs::read_dir(temp_root)? {
    entries.push(e?.path());
  }
  if entries.len() == 1 && entries[0].is_dir() {
    Ok(entries[0].clone())
  } else {
    Ok(temp_root.to_path_buf())
  }
}

fn list_tree(root: &Path, max: usize) -> EntriesDisplay {
  fn walk(acc: &mut Vec<String>, base: &Path, p: &Path, max: usize) {
    if acc.len() >= max {
      return;
    }
    let rel = p.strip_prefix(base).unwrap_or(p);
    acc.push(rel.to_string_lossy().into_owned());
    if let Ok(meta) = std::fs::metadata(p) {
      if meta.is_dir() {
        if let Ok(rd) = std::fs::read_dir(p) {
          for ch in rd.flatten().map(|e| e.path()) {
            if acc.len() >= max {
              break;
            }
            walk(acc, base, &ch, max);
          }
        }
      }
    }
  }
  let mut v = Vec::new();
  walk(&mut v, root, root, max);
  EntriesDisplay(v)
}
