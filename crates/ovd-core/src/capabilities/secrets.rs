use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct AuthSecrets {
  pub username: Option<String>,
  pub password: Option<String>,
  pub video_password: Option<String>,
  pub bearer_token: Option<String>,
  pub headers: Vec<String>,
}

pub trait MasterKeyProvider: Send + Sync + 'static {
  fn load_key(&self) -> Result<Option<[u8; 32]>, String>;
  fn store_key(&self, key: [u8; 32]) -> Result<(), String>;
}

pub trait AuthSecretsStore: Send + Sync + 'static {
  fn is_unlocked(&self) -> bool;
  fn init_or_unlock(&self) -> Result<(), String>;
  fn init_new(&self) -> Result<(), String>;
  fn last_init_error(&self) -> Option<String>;
  fn load_auth_secrets(&self) -> Result<AuthSecrets, String>;
  fn save_auth_secrets(&self, secrets: &AuthSecrets) -> Result<(), String>;
  fn clear_auth_secrets(&self) -> Result<(), String>;
  fn get_many(&self, keys: &[String]) -> Result<HashMap<String, Option<Vec<u8>>>, String>;
  fn set_many(&self, entries: HashMap<String, Option<Vec<u8>>>) -> Result<(), String>;
  fn keys(&self) -> Result<Vec<Vec<u8>>, String>;
}
