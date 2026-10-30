use serde::Serialize;

#[derive(Serialize)]
pub struct CheckResult {
  pub tools: Vec<String>,
  pub dependencies: Vec<super::resolver::DependencyReport>,
  pub warning: Option<String>,
}
