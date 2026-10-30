// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(feature = "dependency-validation")]
  if std::env::args().nth(1).as_deref() == Some("--validate-dependencies") {
    let args: Vec<String> = std::env::args().collect();
    assert_eq!(args.len(), 6, "expected INPUT ROOT REPORT LAYOUT");
    let runtime = tokio::runtime::Runtime::new().expect("validation runtime");
    let result = runtime.block_on(open_video_downloader_lib::validate_dependencies(
      std::path::Path::new(&args[2]),
      std::path::Path::new(&args[3]),
      std::path::Path::new(&args[4]),
      &args[5],
    ));
    if let Err(error) = result {
      eprintln!("{error}");
      std::process::exit(1);
    }
    return;
  }
  open_video_downloader_lib::run();
}
