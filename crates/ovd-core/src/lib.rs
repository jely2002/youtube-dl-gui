use std::collections::HashMap;
use std::sync::{LazyLock, Mutex as StdMutex};

pub mod binaries;
pub mod capabilities;
pub mod config;
pub mod logging;
pub mod models;
pub mod parsers;
pub mod runners;
pub mod scheduling;

pub static RUNNING_GROUPS: LazyLock<StdMutex<HashMap<String, bool>>> =
  LazyLock::new(|| StdMutex::new(HashMap::new()));
