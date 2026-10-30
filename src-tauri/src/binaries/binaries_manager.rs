use std::collections::HashMap;
use std::path::{Path, PathBuf};

use super::resolver::{self, DependencyReport, Discovery, Resolver, Source, Status};
use super::runtime::{self, RuntimePaths};
use crate::binaries::binaries_extractor::{
  extract_tar_bz2, extract_tar_bz2_bundle, extract_zip, extract_zip_bundle,
  hoist_bundle_contents_into_bin,
};
use crate::binaries::binaries_state::CheckResult;
use crate::paths::PathsManager;
use crate::SharedConfig;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tokio::fs;
use tokio::sync::Mutex;

const MANIFEST_URL: &str = "https://jely2002.github.io/youtube-dl-gui/manifest/manifest.json";
const MANIFEST_SIG_URL: &str = "https://jely2002.github.io/youtube-dl-gui/manifest/manifest.sig";
const MANIFEST_PUB_KEY: &str = "ae7988a00d92349e55ff560369e7ec6afdb4b22a7e1dbe62a6769e1f347fa073";

type AnyError = Box<dyn std::error::Error + Send + Sync + 'static>;

#[derive(Deserialize, Serialize)]
struct Manifest {
  #[serde(rename = "generatedAt")]
  generated_at: String,
  tools: IndexMap<String, ToolInfo>,
}

#[derive(Deserialize, Serialize)]
struct ToolInfo {
  version: String,
  files: HashMap<String, FileInfo>,
}

#[derive(Deserialize, Serialize)]
struct FileInfo {
  url: String,
  sha256: String,
  #[serde(default)]
  entry: Option<String>,
  #[serde(default)]
  bundle: Option<BundleInfo>,
}

#[derive(Deserialize, Serialize)]
struct BundleInfo {
  #[serde(default)]
  keep_folder: bool,
  #[serde(default)]
  folder_name: Option<String>,
  entry: String,
  #[serde(default)]
  rename_entry_to: Option<String>,
}

#[derive(Default, Serialize, Deserialize)]
struct Metadata {
  versions: HashMap<String, String>,
  is_locked: bool,
}

#[derive(Default, Serialize, Deserialize, Clone)]
struct ToolError {
  tool: String,
  version: String,
  stage: String,
  error: String,
}

#[derive(Default, Serialize, Deserialize, Clone)]
struct ToolResult {
  successes: Vec<String>,
  failures: Vec<ToolError>,
  error: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Clone)]
struct ToolStart {
  tool: String,
  version: String,
}

#[derive(Default, Serialize, Deserialize, Clone)]
struct ToolProgress {
  tool: String,
  total: u64,
  received: u64,
}

#[derive(Default, Serialize, Deserialize, Clone)]
struct ToolComplete {
  tool: String,
}

pub struct BinariesManager {
  app: AppHandle<Wry>,
  client: reqwest::Client,
  bin_dir: PathBuf,
  runtime_root: PathBuf,
  bundled: bool,
  operation: Mutex<Resolver>,
}

impl BinariesManager {
  pub fn new(app: &AppHandle<Wry>) -> Self {
    let paths_manager = app.state::<PathsManager>();
    Self {
      app: app.clone(),
      client: reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .expect("HTTP client"),
      bin_dir: paths_manager.bin_dir().clone(),
      runtime_root: paths_manager
        .app_dir()
        .join("dependency-runtime")
        .join(uuid::Uuid::new_v4().to_string()),
      bundled: paths_manager.is_microsoft_store_app(),
      operation: Mutex::new(Resolver::default()),
    }
  }

  fn current_platform() -> String {
    let os = match std::env::consts::OS {
      "macos" => "darwin",
      other => other,
    };
    format!("{}-{}", os, std::env::consts::ARCH)
  }

  fn select_file<'a>(
    files: &'a HashMap<String, FileInfo>,
    tool: &str,
    arch: &str,
  ) -> Option<&'a FileInfo> {
    resolver::asset_platform(tool, arch, |key| files.contains_key(key))
      .and_then(|key| files.get(key))
  }

  async fn discovery(&self) -> Result<Discovery, AnyError> {
    let meta = self
      .load_metadata(&self.bin_dir.join("metadata.json"))
      .await?;
    let config = self.app.state::<SharedConfig>().load();
    Ok(Discovery::from_environment(
      self.bin_dir.clone(),
      config.dependencies.clone(),
      self.bundled || meta.is_locked,
    ))
  }

  pub async fn status(&self) -> Result<Vec<DependencyReport>, AnyError> {
    let mut resolver = self.operation.lock().await;
    Ok(resolver.resolve(&self.discovery().await?).await)
  }

  pub async fn runtime_paths(&self) -> Result<RuntimePaths, String> {
    let mut resolver = self.operation.lock().await;
    let discovery = self.discovery().await.map_err(|e| e.to_string())?;
    let reports = resolver.resolve(&discovery).await;
    if let Some(report) = reports
      .iter()
      .find(|r| r.status == Status::ConfiguredInvalid)
    {
      return Err(format!("{}: configured executable is invalid: {}. Automatic fallback was not attempted; clear the path to restore automatic selection.", report.tool, report.diagnostics.last().map(|d| d.reason.as_str()).unwrap_or("validation failed")));
    }
    if let Some(report) = reports
      .iter()
      .find(|r| r.tool != "AtomicParsley" && r.active.is_none())
    {
      let reason = report
        .diagnostics
        .iter()
        .map(|d| format!("{}: {}", d.path.display(), d.reason))
        .collect::<Vec<_>>()
        .join("; ");
      return Err(format!(
        "{}: no usable executable after {} resolution. {}",
        report.tool,
        if discovery.locked {
          "bundled"
        } else {
          "system and managed"
        },
        reason
      ));
    }
    runtime::prepare(&reports, &self.runtime_root).await
  }

  fn build_plan<'a>(
    manifest: &'a Manifest,
    meta: &Metadata,
    arch: &str,
    reports: &[DependencyReport],
    allow: Option<&[String]>,
    update_managed: bool,
  ) -> Vec<(&'a str, &'a ToolInfo)> {
    manifest
      .tools
      .iter()
      .filter_map(|(name, info)| {
        let report = reports.iter().find(|r| r.tool == *name)?;
        if allow.is_some_and(|allowed| !allowed.contains(name))
          || report.status == Status::ConfiguredInvalid
          || Self::select_file(&info.files, name, arch).is_none()
        {
          return None;
        }
        let managed_update = report
          .active
          .as_ref()
          .is_some_and(|a| a.source == Source::Managed)
          && update_managed
          && meta.versions.get(name) != Some(&info.version);
        (report.requires_install() || managed_update).then_some((name.as_str(), info))
      })
      .collect()
  }

  pub async fn check(&self) -> Result<CheckResult, AnyError> {
    let mut resolver = self.operation.lock().await;
    let discovery = self.discovery().await?;
    let mut dependencies = resolver.resolve(&discovery).await;
    drop(resolver);
    if discovery.locked {
      return Ok(CheckResult {
        tools: Vec::new(),
        dependencies,
        warning: None,
      });
    }
    let config = self.app.state::<SharedConfig>().load();
    let update_managed = config.update.update_binaries;
    let needs_manifest = dependencies.iter().any(|r| {
      r.requires_install()
        || (update_managed
          && r
            .active
            .as_ref()
            .is_some_and(|a| a.source == Source::Managed))
    });
    if !needs_manifest {
      return Ok(CheckResult {
        tools: Vec::new(),
        dependencies,
        warning: None,
      });
    }
    let manifest = match self.fetch_manifest().await {
      Ok(manifest) => manifest,
      Err(e) => {
        // Local resolution always works offline. Only missing required tools
        // prevent later execution; an unavailable update service does not.
        return Ok(CheckResult {
          tools: Vec::new(),
          dependencies,
          warning: Some(format!("Unable to check managed dependencies: {e}")),
        });
      }
    };
    let meta = self
      .load_metadata(&self.bin_dir.join("metadata.json"))
      .await?;
    let arch = Self::current_platform();
    let tools = Self::build_plan(&manifest, &meta, &arch, &dependencies, None, update_managed)
      .iter()
      .map(|(name, _)| name.to_string())
      .collect();
    for report in &mut dependencies {
      if let Some(info) = manifest.tools.get(&report.tool) {
        if Self::select_file(&info.files, &report.tool, &arch).is_none()
          && report.active.is_none()
          && report.status != Status::ConfiguredInvalid
        {
          report.status = Status::Unavailable;
        }
        if let Some(active) = &mut report.active {
          if active.source == Source::System
            && !matches!(report.tool.as_str(), "ffmpeg" | "ffprobe")
            && resolver::older_than(&active.version, &info.version)
          {
            active.status = Status::OutdatedCompatible;
            report.status = Status::OutdatedCompatible;
          }
        }
      }
    }
    Ok(CheckResult {
      tools,
      dependencies,
      warning: None,
    })
  }

  pub async fn ensure(&self, allow: Option<&[String]>) -> Result<(), AnyError> {
    // One lock spans discovery, downloads, validation and metadata publication.
    // Queued callers recheck the new state rather than starting duplicate writes.
    let mut resolver = self.operation.lock().await;
    let discovery = self.discovery().await?;
    let reports = resolver.resolve(&discovery).await;
    if discovery.locked {
      return Ok(());
    }
    if let Some(report) = reports
      .iter()
      .find(|r| r.status == Status::ConfiguredInvalid && allow.is_none_or(|a| a.contains(&r.tool)))
    {
      return Err(format!("{}: explicitly configured executable failed validation; clear the configured path to allow automatic fallback", report.tool).into());
    }
    let update_managed = self
      .app
      .state::<SharedConfig>()
      .load()
      .update
      .update_binaries;
    if !reports.iter().any(|r| {
      allow.is_none_or(|a| a.contains(&r.tool))
        && (r.requires_install()
          || (update_managed
            && r
              .active
              .as_ref()
              .is_some_and(|a| a.source == Source::Managed)))
    }) {
      return Ok(());
    }
    let manifest = self.fetch_manifest().await?;
    let bin = &self.bin_dir;
    let meta_path = bin.join("metadata.json");
    let mut meta = self.load_metadata(&meta_path).await?;
    let arch = Self::current_platform();
    let plan = Self::build_plan(&manifest, &meta, &arch, &reports, allow, update_managed);
    if plan.is_empty() {
      return Ok(());
    }
    fs::create_dir_all(bin).await?;
    let mut successes = Vec::new();
    let mut failures = Vec::new();
    for (name, info) in plan {
      match self.install_single_tool(bin, &arch, name, info).await {
        Ok(()) => {
          meta.versions.insert(name.to_string(), info.version.clone());
          successes.push(name.to_string());
        }
        Err(error) => failures.push(error),
      }
    }
    let after_install = resolver.resolve(&discovery).await;
    let pair_broken = after_install.iter().any(|r| {
      matches!(r.tool.as_str(), "ffmpeg" | "ffprobe")
        && r.status == Status::Incompatible
        && r.active.is_none()
    });
    if pair_broken && !successes.is_empty() {
      let pair = vec!["ffmpeg".to_string(), "ffprobe".to_string()];
      for (name, info) in
        Self::build_plan(&manifest, &meta, &arch, &after_install, Some(&pair), false)
      {
        if successes.iter().any(|n| n == name) {
          continue;
        }
        match self.install_single_tool(bin, &arch, name, info).await {
          Ok(()) => {
            meta.versions.insert(name.into(), info.version.clone());
            successes.push(name.into());
          }
          Err(error) => failures.push(error),
        }
      }
    }
    if let Err(error) = self.save_metadata(&meta_path, &meta).await {
      let _ = self.app.emit(
        "binary_update_complete",
        ToolResult {
          successes,
          failures,
          error: Some(error.to_string()),
        },
      );
      return Err(error);
    }
    // Validate the selected set after installation, including cross-tool pairing.
    let final_reports = resolver.resolve(&discovery).await;
    for report in final_reports
      .iter()
      .filter(|r| successes.contains(&r.tool) && r.active.is_none())
    {
      let reason = report
        .diagnostics
        .last()
        .map(|d| d.reason.clone())
        .unwrap_or_else(|| "no compatible dependency after installation".into());
      self.emit_tool_error(&report.tool, "", "resolve_after_install", &reason);
      failures.push(ToolError {
        tool: report.tool.clone(),
        version: String::new(),
        stage: "resolve_after_install".into(),
        error: report
          .diagnostics
          .last()
          .map(|d| d.reason.clone())
          .unwrap_or_else(|| "no compatible dependency after installation".into()),
      });
    }
    let _ = self.app.emit(
      "binary_update_complete",
      ToolResult {
        successes,
        failures: failures.clone(),
        error: None,
      },
    );
    if !failures.is_empty() {
      return Err(
        "one or more tools failed to install or validate; see dependency diagnostics".into(),
      );
    }
    Ok(())
  }

  async fn install_single_tool(
    &self,
    bin: &Path,
    arch: &str,
    name: &str,
    info: &ToolInfo,
  ) -> Result<(), ToolError> {
    let Some(file) = Self::select_file(&info.files, name, arch) else {
      return self.fail_stage(
        name,
        &info.version,
        "select_file",
        "no compatible file for current platform".to_string(),
      );
    };

    let url = &file.url;
    let Some(filename) = url.rsplit('/').next() else {
      return self.fail_stage(
        name,
        &info.version,
        "parse_filename",
        "missing file name in URL".to_string(),
      );
    };
    let staging = bin.join(format!(".install-{name}-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&staging).await.map_err(|e| ToolError {
      tool: name.into(),
      version: info.version.clone(),
      stage: "staging".into(),
      error: e.to_string(),
    })?;
    let dest = staging.join(filename);

    let _ = self.app.emit(
      "binary_download_start",
      ToolStart {
        tool: name.to_string(),
        version: info.version.to_string(),
      },
    );

    if let Err(e) = self
      .download_and_verify(
        name,
        url,
        &file.sha256,
        &dest,
        file.entry.as_deref(),
        file.bundle.as_ref(),
      )
      .await
    {
      let _ = fs::remove_dir_all(&staging).await;
      return self.fail_stage(name, &info.version, "download_verify", e.to_string());
    }

    let staged_executable = staging.join(resolver::executable_name(name));
    let mut validator = Resolver::default();
    let staged_discovery = Discovery {
      bin_dir: staging.clone(),
      search_dirs: Vec::new(),
      configured: Default::default(),
      locked: true,
    };
    let validated = validator.resolve(&staged_discovery).await;
    let report = validated.iter().find(|r| r.tool == name).unwrap();
    if report.active.is_none() {
      let message = report
        .diagnostics
        .last()
        .map(|d| d.reason.clone())
        .unwrap_or_else(|| format!("{} missing after install", staged_executable.display()));
      let _ = fs::remove_dir_all(&staging).await;
      return self.fail_stage(name, &info.version, "post_install_validation", message);
    }
    if let Err(error) = super::installer::publish(&staging, bin).await {
      let _ = fs::remove_dir_all(&staging).await;
      return self.fail_stage(name, &info.version, "publish", error.to_string());
    }

    let _ = self.app.emit(
      "binary_download_complete",
      ToolComplete {
        tool: name.to_string(),
      },
    );

    Ok(())
  }

  fn fail_stage(
    &self,
    name: &str,
    version: &str,
    stage: &str,
    msg: String,
  ) -> Result<(), ToolError> {
    self.emit_tool_error(name, version, stage, &msg);
    Err(ToolError {
      tool: name.to_string(),
      version: version.to_string(),
      stage: stage.to_string(),
      error: msg,
    })
  }

  async fn fetch_manifest(&self) -> Result<Manifest, AnyError> {
    let manifest_bytes = self
      .client
      .get(MANIFEST_URL)
      .timeout(std::time::Duration::from_secs(10))
      .send()
      .await?
      .error_for_status()?
      .bytes()
      .await?;

    let sig_b64 = self
      .client
      .get(MANIFEST_SIG_URL)
      .timeout(std::time::Duration::from_secs(10))
      .send()
      .await?
      .error_for_status()?
      .bytes()
      .await?;
    let sig_raw = base64::engine::general_purpose::STANDARD.decode(sig_b64)?;
    let sig = Signature::from_slice(&sig_raw)?;

    let key_vec = hex::decode(MANIFEST_PUB_KEY)?;
    let key_bytes: [u8; 32] = key_vec.as_slice().try_into().map_err(|_| {
      format!(
        "invalid public key length: expected 32, got {}",
        key_vec.len()
      )
    })?;

    let vk = VerifyingKey::from_bytes(&key_bytes)?;
    vk.verify(&manifest_bytes, &sig)?;

    let manifest: Manifest = serde_json::from_slice(&manifest_bytes)?;
    Ok(manifest)
  }

  async fn download_and_verify(
    &self,
    tool: &str,
    url: &str,
    sha256: &str,
    dest: &Path,
    entry: Option<&str>,
    bundle: Option<&BundleInfo>,
  ) -> Result<(), AnyError> {
    super::installer::download_verified(&self.client, url, sha256, dest, |received, total| {
      let _ = self.app.emit(
        "binary_download_progress",
        ToolProgress {
          tool: tool.into(),
          received,
          total,
        },
      );
    })
    .await?;

    let parent = dest.parent().ok_or("download destination has no parent")?;
    let canonical = parent.join(resolver::executable_name(tool));

    if let Some(ext) = dest.extension().and_then(|e| e.to_str()) {
      match ext {
        "zip" => {
          if let Some(b) = bundle {
            let (dir, _entry_abs) = extract_zip_bundle(
              dest,
              parent,
              b.folder_name.as_deref(),
              Path::new(&b.entry),
              b.rename_entry_to.as_deref(),
            )
            .await?;
            fs::remove_file(dest).await?;
            hoist_bundle_contents_into_bin(&dir, &canonical).await?;
          } else {
            extract_zip(tool, canonical.clone(), dest, parent, entry).await?;
            fs::remove_file(dest).await?;
          }
        }
        "bz2" => {
          if let Some(b) = bundle {
            let (dir, _entry_abs) = extract_tar_bz2_bundle(
              dest,
              parent,
              b.folder_name.as_deref(),
              Path::new(&b.entry),
              b.rename_entry_to.as_deref(),
            )
            .await?;
            fs::remove_file(dest).await?;
            hoist_bundle_contents_into_bin(&dir, &canonical).await?;
          } else {
            extract_tar_bz2(tool, canonical.clone(), dest, parent, entry).await?;
            fs::remove_file(dest).await?;
          }
        }
        _ => {
          super::installer::rename_if_needed(dest, &canonical).await?;
        }
      }
    } else {
      super::installer::rename_if_needed(dest, &canonical).await?;
    }

    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let mut perms = std::fs::metadata(&canonical)?.permissions();
      if perms.mode() & 0o111 == 0 {
        perms.set_mode(0o755);
        std::fs::set_permissions(&canonical, perms)?;
      }
    }

    Ok(())
  }

  async fn load_metadata(&self, path: &Path) -> Result<Metadata, AnyError> {
    if let Ok(bytes) = fs::read(path).await {
      let meta = serde_json::from_slice(&bytes)?;
      Ok(meta)
    } else {
      Ok(Metadata::default())
    }
  }

  async fn save_metadata(&self, path: &Path, meta: &Metadata) -> Result<(), AnyError> {
    let bytes = serde_json::to_vec(meta)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, bytes).await?;
    fs::rename(temporary, path).await?;
    Ok(())
  }

  fn emit_tool_error(&self, tool: &str, version: &str, stage: &str, error: impl Into<String>) {
    let _ = self.app.emit(
      "binary_download_error",
      ToolError {
        tool: tool.to_string(),
        version: version.to_string(),
        stage: stage.to_string(),
        error: error.into(),
      },
    );
  }
}

impl Drop for BinariesManager {
  fn drop(&mut self) {
    let _ = std::fs::remove_dir_all(&self.runtime_root);
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  fn manifest() -> Manifest {
    serde_json::from_value(serde_json::json!({"generatedAt": "test", "tools": {
      "yt-dlp": {"version": "2026.01.01", "files": {"linux-x86_64": {"url": "https://example.test/yt-dlp", "sha256": "test"}}},
      "ffmpeg": {"version": "v7.0.0", "files": {"linux-x86_64": {"url": "https://example.test/ffmpeg", "sha256": "test"}}},
      "ffprobe": {"version": "v7.0.0", "files": {"linux-x86_64": {"url": "https://example.test/ffprobe", "sha256": "test"}}}
    }})).unwrap()
  }
  fn report(tool: &str, source: Option<Source>, status: Status) -> DependencyReport {
    DependencyReport {
      tool: tool.into(),
      locked: false,
      status,
      diagnostics: Vec::new(),
      active: source.map(|source| resolver::ResolvedDependency {
        tool: tool.into(),
        path: PathBuf::from("/test").join(tool),
        source,
        version: "6.0.0".into(),
        status: Status::Compatible,
        compatibility: "test".into(),
        avformat_major: Some(60),
      }),
    }
  }
  #[test]
  fn update_plan_updates_managed_only_and_installs_individual_missing_tools() {
    let manifest = manifest();
    let reports = vec![
      report("yt-dlp", Some(Source::System), Status::Compatible),
      report("ffmpeg", Some(Source::Managed), Status::Compatible),
      report("ffprobe", None, Status::Missing),
    ];
    let meta = Metadata::default();
    let names: Vec<_> =
      BinariesManager::build_plan(&manifest, &meta, "linux-x86_64", &reports, None, true)
        .iter()
        .map(|(n, _)| *n)
        .collect();
    assert_eq!(names, vec!["ffmpeg", "ffprobe"]);
    let names: Vec<_> =
      BinariesManager::build_plan(&manifest, &meta, "linux-x86_64", &reports, None, false)
        .iter()
        .map(|(n, _)| *n)
        .collect();
    assert_eq!(names, vec!["ffprobe"]);
  }
  #[test]
  fn update_plan_reuses_current_managed_and_never_overrides_pins_or_bundles() {
    let manifest = manifest();
    let reports = vec![
      report("yt-dlp", None, Status::ConfiguredInvalid),
      report("ffmpeg", Some(Source::Managed), Status::Compatible),
      report("ffprobe", Some(Source::Bundled), Status::Compatible),
    ];
    let mut meta = Metadata::default();
    meta.versions.insert("ffmpeg".into(), "v7.0.0".into());
    assert!(
      BinariesManager::build_plan(&manifest, &meta, "linux-x86_64", &reports, None, true)
        .is_empty()
    );
    assert!(
      BinariesManager::build_plan(&manifest, &meta, "linux-aarch64", &reports, None, true)
        .is_empty()
    );
  }
}
