use super::vault::StrongholdVaultState;
use base64::engine::general_purpose;
use base64::Engine;
use ovd_core::capabilities::{AuthSecrets, AuthSecretsStore, MasterKeyProvider};
use rand::RngCore;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_stronghold::stronghold::Stronghold;

const CLIENT: &[u8] = b"ovd";
const KR_SERVICE: &str = "com.jelleglebbeek.youtube-dl-gui";
const KR_ACCOUNT: &str = "master_key";

pub struct StrongholdSecretsStore<P: MasterKeyProvider> {
  vault: Arc<StrongholdVaultState>,
  key_provider: P,
}

impl<P: MasterKeyProvider> AuthSecretsStore for StrongholdSecretsStore<P> {
  fn is_unlocked(&self) -> bool {
    self
      .vault
      .inner
      .lock()
      .ok()
      .and_then(|g| g.as_ref().map(|_| ()))
      .is_some()
  }

  fn init_or_unlock(&self) -> Result<(), String> {
    self.set_init_error(None);

    // If no snapshot yet, always create new.
    if !self.vault.snapshot_path.exists() {
      return self.create_and_store_new();
    }

    match self.key_provider.load_key() {
      Ok(Some(key)) => {
        if let Err(open_err) = self.open_with_key(&key) {
          if let Err(recreate_err) = self.create_and_store_new() {
            self.set_init_error(Some(format!(
              "Recreate vault failed after bad key/snapshot: {recreate_err}"
            )));
            return Err(format!(
              "open failed: {open_err}; recreate failed: {recreate_err}"
            ));
          }
        }
      }
      Ok(None) => {
        if let Err(e) = self.create_and_store_new() {
          self.set_init_error(Some(format!("Create vault failed (no key): {e}")));
          return Err(e);
        }
      }
      Err(e) => {
        self.set_init_error(Some(e.clone()));
        return Err(e);
      }
    }

    Ok(())
  }

  fn init_new(&self) -> Result<(), String> {
    self.set_init_error(None);

    if self.vault.snapshot_path.exists() {
      let _ = std::fs::remove_file(&self.vault.snapshot_path);
    }

    self.create_and_store_new()
  }

  fn last_init_error(&self) -> Option<String> {
    self.vault.init_error.lock().ok().and_then(|g| g.clone())
  }

  fn load_auth_secrets(&self) -> Result<AuthSecrets, String> {
    self.with_unlocked(|sh| {
      let store = sh.store();

      let get = |key: &str| -> Result<Option<String>, String> {
        match store.get(key.as_bytes()).map_err(|e| e.to_string())? {
          Some(bytes) => Self::normalize_opt_string(bytes),
          None => Ok(None),
        }
      };

      let username = get("auth.username")?;
      let password = get("auth.password")?;
      let video_password = get("video.password")?;
      let bearer_token = get("auth.bearer")?;

      let mut headers: Vec<String> = Vec::new();
      if let Some(hblob) = get("auth.headers")? {
        for line in hblob.lines() {
          let line = line.trim();
          if line.is_empty() || !line.contains(':') {
            continue;
          }
          headers.push(line.to_string());
        }
      }

      Ok(AuthSecrets {
        username,
        password,
        video_password,
        bearer_token,
        headers,
      })
    })
  }

  fn save_auth_secrets(&self, secrets: &AuthSecrets) -> Result<(), String> {
    self.with_unlocked(|sh| {
      let store = sh.store();

      store
        .insert(
          Vec::from(b"auth.username"),
          Self::encode_opt_string(&secrets.username),
          None,
        )
        .map_err(|e| e.to_string())?;
      store
        .insert(
          Vec::from(b"auth.password"),
          Self::encode_opt_string(&secrets.password),
          None,
        )
        .map_err(|e| e.to_string())?;
      store
        .insert(
          Vec::from(b"video.password"),
          Self::encode_opt_string(&secrets.video_password),
          None,
        )
        .map_err(|e| e.to_string())?;
      store
        .insert(
          Vec::from(b"auth.bearer"),
          Self::encode_opt_string(&secrets.bearer_token),
          None,
        )
        .map_err(|e| e.to_string())?;

      let hblob = if secrets.headers.is_empty() {
        None
      } else {
        Some(secrets.headers.join("\n"))
      };
      store
        .insert(
          Vec::from(b"auth.headers"),
          Self::encode_opt_string(&hblob),
          None,
        )
        .map_err(|e| e.to_string())?;

      sh.save()
        .map_err(|e| format!("stronghold save failed: {e}"))?;
      Ok(())
    })
  }

  fn clear_auth_secrets(&self) -> Result<(), String> {
    self.save_auth_secrets(&AuthSecrets::default())
  }

  fn get_many(&self, keys: &[String]) -> Result<HashMap<String, Option<Vec<u8>>>, String> {
    self.with_unlocked(|sh| {
      let store = sh.store();
      let mut out = HashMap::with_capacity(keys.len());
      for key in keys {
        let val = store.get(key.as_bytes()).map_err(|e| e.to_string())?;
        out.insert(key.clone(), val);
      }
      Ok(out)
    })
  }

  fn set_many(&self, entries: HashMap<String, Option<Vec<u8>>>) -> Result<(), String> {
    self.with_unlocked(|sh| {
      // Your version uses get_client(CLIENT) and then client.store()
      let client = sh
        .get_client(CLIENT)
        .map_err(|e| format!("get_client failed: {e}"))?;
      let store = client.store();

      for (key, maybe_value) in entries {
        match maybe_value {
          Some(value) => {
            store
              .insert(key.into_bytes(), value, None)
              .map_err(|e| e.to_string())?;
          }
          None => {
            store.delete(key.as_bytes()).map_err(|e| e.to_string())?;
          }
        }
      }

      sh.write_client(CLIENT)
        .map_err(|e| format!("write_client failed: {e}"))?;
      sh.save().map_err(|e| e.to_string())
    })
  }

  fn keys(&self) -> Result<Vec<Vec<u8>>, String> {
    self.with_unlocked(|sh| {
      let store = sh.store();

      store.keys().map_err(|e| e.to_string())
    })
  }
}

impl<P: MasterKeyProvider> StrongholdSecretsStore<P> {
  pub fn new(vault: Arc<StrongholdVaultState>, key_provider: P) -> Self {
    Self {
      vault,
      key_provider,
    }
  }

  fn set_init_error(&self, msg: Option<String>) {
    *self.vault.init_error.lock().unwrap() = msg;
  }

  fn generate_master_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    rand::rng().fill_bytes(&mut key);
    key
  }

  fn open_with_key(&self, key: &[u8]) -> Result<(), String> {
    let sh = Stronghold::new(&self.vault.snapshot_path, key.to_vec())
      .map_err(|e| format!("stronghold open failed: {e}"))?;

    if sh.load_client(CLIENT).is_err() {
      sh.create_client(CLIENT)
        .map_err(|e| format!("create_client failed: {e}"))?;
      sh.write_client(CLIENT)
        .map_err(|e| format!("write_client failed: {e}"))?;
      sh.save().map_err(|e| format!("save failed: {e}"))?;
    }

    *self.vault.inner.lock().unwrap() = Some(sh);
    Ok(())
  }

  fn create_and_store_new(&self) -> Result<(), String> {
    let key = Self::generate_master_key();
    self.open_with_key(&key)?;
    self.key_provider.store_key(key)?;
    Ok(())
  }

  fn with_unlocked<R>(
    &self,
    f: impl FnOnce(&Stronghold) -> Result<R, String>,
  ) -> Result<R, String> {
    let guard = self
      .vault
      .inner
      .lock()
      .map_err(|_| "failed to lock stronghold".to_string())?;
    let sh = guard.as_ref().ok_or_else(|| "vault locked".to_string())?;
    f(sh)
  }

  fn normalize_opt_string(bytes: Vec<u8>) -> Result<Option<String>, String> {
    if bytes.is_empty() {
      return Ok(None);
    }
    let s = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    let t = s.trim();
    if t.is_empty() {
      Ok(None)
    } else {
      Ok(Some(t.to_string()))
    }
  }

  fn encode_opt_string(val: &Option<String>) -> Vec<u8> {
    match val {
      Some(s) if !s.trim().is_empty() => s.trim().as_bytes().to_vec(),
      _ => Vec::new(),
    }
  }
}

#[derive(Clone)]
pub struct KeyringMasterKeyProvider {
  app: AppHandle,
}

impl KeyringMasterKeyProvider {
  pub fn new(app: AppHandle) -> Self {
    Self { app }
  }
}

impl MasterKeyProvider for KeyringMasterKeyProvider {
  fn load_key(&self) -> Result<Option<[u8; 32]>, String> {
    let opt = self
      .app
      .keyring()
      .get_password(KR_SERVICE, KR_ACCOUNT)
      .map_err(|e| format!("Secure keyring unavailable: {e}"))?;

    let Some(b64) = opt else { return Ok(None) };

    let bytes = general_purpose::STANDARD
      .decode(b64.trim())
      .map_err(|e| format!("Master key decode failed: {e}"))?;

    if bytes.len() != 32 {
      return Err(format!(
        "Master key has invalid length: expected 32, got {}",
        bytes.len()
      ));
    }

    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(Some(key))
  }

  fn store_key(&self, key: [u8; 32]) -> Result<(), String> {
    let b64 = general_purpose::STANDARD.encode(key);
    self
      .app
      .keyring()
      .set_password(KR_SERVICE, KR_ACCOUNT, &b64)
      .map_err(|e| format!("failed to save key to keyring: {e}"))?;
    Ok(())
  }
}
