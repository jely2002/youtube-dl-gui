// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// Only apply this to desktop builds (server should keep a console for logs).
#![cfg_attr(
  all(not(debug_assertions), not(feature = "server")),
  windows_subsystem = "windows"
)]

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
  let want_server = std::env::args().any(|a| a == "--server");

  if want_server {
    #[cfg(feature = "server")]
    {
      let rt = tokio::runtime::Runtime::new()?;
      return rt.block_on(ovd_server::run());
    }

    #[cfg(not(feature = "server"))]
    {
      return Err(Box::<dyn std::error::Error + Send + Sync>::from(
        "Built without server support (rebuild with --features server)",
      ));
    }
  }

  open_video_downloader_lib::run();
  Ok(())
}
