use crate::state::json_handle::JsonStoreHandle;
use crate::state::json_state::JsonBackedState;
use crate::state::preferences_models::Preferences;

impl JsonBackedState for Preferences {
  const STORE_FILE: &'static str = "preferences.store.json";
  const ROOT_KEY: &'static str = "preferences";

  fn default_value() -> Self {
    Self::default()
  }
}

pub type PreferencesHandle = JsonStoreHandle<Preferences>;
