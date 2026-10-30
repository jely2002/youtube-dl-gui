use std::path::Path;
#[tokio::main]
async fn main() {
  let args: Vec<String> = std::env::args().collect();
  assert_eq!(args.len(), 4, "usage: live-validation INPUT ROOT REPORT");
  if let Err(error) = ovd_dependency_resolver_tests::validation::run(
    Path::new(&args[1]),
    Path::new(&args[2]),
    Path::new(&args[3]),
  )
  .await
  {
    eprintln!("{error}");
    std::process::exit(1);
  }
}
