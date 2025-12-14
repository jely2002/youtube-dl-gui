use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticLevel {
  Warning,
  Error,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEvent {
  pub id: String,
  pub group_id: String,
  pub level: DiagnosticLevel,
  pub code: String,
  pub component: Option<String>,
  pub message: String,
  pub raw: String,
  pub timestamp: u128,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RulesFile {
  pub rules: Vec<RuleSpec>,
  #[serde(default = "default_fallback_code")]
  pub fallback_code: String,
}

fn default_fallback_code() -> String {
  "Unknown".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleSpec {
  pub code: String,
  #[serde(default)]
  pub component: Option<String>,
  #[serde(default = "default_applies_to")]
  pub applies_to: AppliesTo,
  pub patterns: Vec<PatternSpec>,
}

const fn default_applies_to() -> AppliesTo {
  AppliesTo::Both
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppliesTo {
  Error,
  Warning,
  Both,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatternSpec {
  pub kind: PatternKind,
  pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PatternKind {
  Substr,
  Regex,
}
