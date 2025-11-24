use base64::engine::general_purpose;
use base64::Engine;
use rand::RngCore;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_stronghold::stronghold::Stronghold;

pub const CLIENT: &[u8] = b"ovd";
const KR_SERVICE: &str = "com.jelleglebbeek.youtube-dl-gui";
const KR_ACCOUNT: &str = "master_key";

#[derive(Debug, Default, Clone)]
pub struct AuthSecrets {
  pub username: Option<String>,
  pub password: Option<String>,
  pub video_password: Option<String>,
  pub bearer_token: Option<String>,
  pub headers: Vec<String>,
}

pub struct StrongholdState {
  pub snapshot_path: PathBuf,
  pub inner: Mutex<Option<Stronghold>>,
  pub init_error: Mutex<Option<String>>,
}

impl StrongholdState {
  pub const fn new(snapshot_path: PathBuf) -> Self {
    Self {
      snapshot_path,
      inner: Mutex::new(None),
      init_error: Mutex::new(None),
    }
  }
  pub fn load_auth_secrets(&self) -> Result<AuthSecrets, String> {
    let (username, password, video_password, bearer_token, headers) = {
      let guard = self
        .inner
        .lock()
        .map_err(|_| "failed to lock stronghold".to_string())?;
      let sh = guard.as_ref().ok_or_else(|| "vault locked".to_string())?;
      let store = sh.store();

      let get = |key: &str| -> Result<Option<String>, String> {
        match store.get(key.as_bytes()).map_err(|e| e.to_string())? {
          Some(bytes) if !bytes.is_empty() => {
            let s = String::from_utf8(bytes).map_err(|e| e.to_string())?;
            let t = s.trim();
            if t.is_empty() {
              Ok(None)
            } else {
              Ok(Some(t.to_string()))
            }
          }
          _ => Ok(None),
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

      (username, password, video_password, bearer_token, headers)
    };

    Ok(AuthSecrets {
      username,
      password,
      video_password,
      bearer_token,
      headers,
    })
  }
}

fn generate_master_key() -> [u8; 32] {
  let mut key = [0u8; 32];
  rand::rng().fill_bytes(&mut key);
  key
}

fn open_with_key(state: &StrongholdState, key: &[u8]) -> Result<(), String> {
  let sh = Stronghold::new(&state.snapshot_path, key.to_vec())
    .map_err(|e| format!("stronghold open failed: {e}"))?;

  if sh.load_client(CLIENT).is_err() {
    sh.create_client(CLIENT)
      .map_err(|e| format!("create_client failed: {e}"))?;
    sh.write_client(CLIENT)
      .map_err(|e| format!("write_client failed: {e}"))?;
    sh.save().map_err(|e| format!("save failed: {e}"))?;
  }

  *state.inner.lock().unwrap() = Some(sh);
  Ok(())
}

fn create_new_stronghold(state: &StrongholdState, key: &[u8]) -> Result<(), String> {
  open_with_key(state, key)
}

pub fn init(app: &AppHandle, state: &State<StrongholdState>) -> Result<(), String> {
  create_and_store_new(app, state)
}

#[allow(dead_code)]
pub fn init_on_startup(app: &AppHandle, state: &State<StrongholdState>) {
  if !state.snapshot_path.exists() {
    return;
  }

  *state.init_error.lock().unwrap() = None;

  let keyring = app.keyring();
  match keyring.get_password(KR_SERVICE, KR_ACCOUNT) {
    Ok(opt) => {
      if let Some(b64) = opt {
        match general_purpose::STANDARD.decode(&b64) {
          Ok(key_bytes) => {
            if let Err(_e) = open_with_key(state, &key_bytes) {
              if let Err(setup_err) = create_and_store_new(app, state) {
                *state.init_error.lock().unwrap() =
                  Some(format!("Recreate vault failed after bad key: {setup_err}"));
              }
            }
          }
          Err(_) => {
            if let Err(setup_err) = create_and_store_new(app, state) {
              *state.init_error.lock().unwrap() = Some(format!(
                "Recreate vault failed (malformed key): {setup_err}"
              ));
            }
          }
        }
      }
    }
    Err(e) => {
      *state.init_error.lock().unwrap() = Some(format!("Secure keyring unavailable: {e}"));
    }
  }
}

fn create_and_store_new(app: &AppHandle, state: &State<StrongholdState>) -> Result<(), String> {
  let key = generate_master_key();
  create_new_stronghold(state, &key)?;
  let b64 = general_purpose::STANDARD.encode(key);
  app
    .keyring()
    .set_password(KR_SERVICE, KR_ACCOUNT, &b64)
    .map_err(|e| format!("failed to save key to keyring: {e}"))?;
  Ok(())
}
