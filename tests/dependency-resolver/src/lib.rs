pub mod runners {
  pub mod ytdlp_process {
    include!(concat!(
      env!("CARGO_MANIFEST_DIR"),
      "/../../src-tauri/src/runners/ytdlp_process.rs"
    ));
  }
}
#[path = "../../../src-tauri/src/binaries/binaries_extractor.rs"]
pub mod binaries_extractor;
#[path = "../../../src-tauri/src/binaries/installer.rs"]
pub mod installer;
#[path = "../../../src-tauri/src/binaries/resolver.rs"]
pub mod resolver;
#[path = "../../../src-tauri/src/binaries/runtime.rs"]
pub mod runtime;
pub mod binaries {
  pub use crate::{binaries_extractor, installer, resolver, runtime};
}

#[path = "../../../src-tauri/src/binaries/validation.rs"]
pub mod validation;
