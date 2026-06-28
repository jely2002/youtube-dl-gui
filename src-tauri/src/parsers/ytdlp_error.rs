use crate::models::error::{AppliesTo, DiagnosticEvent, DiagnosticLevel, PatternKind, RulesFile};
use regex::Regex;
use std::borrow::Cow;
use std::time::{SystemTime, UNIX_EPOCH};

const INPUT_FILTER_SKIPPED_CODE: &str = "input_filter_skipped";

struct LoadedPattern {
  kind: PatternKind,
  value_lower: Option<String>,
  regex: Option<Regex>,
}

struct LoadedRule {
  code: String,
  component_lower: Option<String>,
  applies_to: AppliesTo,
  patterns: Vec<LoadedPattern>,
}

pub struct DiagnosticMatcher {
  rules: Vec<LoadedRule>,
  fallback_code: String,
}

impl DiagnosticMatcher {
  pub fn from_json(json: &str) -> Result<Self, String> {
    let parsed: RulesFile =
      serde_json::from_str(json).map_err(|e| format!("Failed to parse rules: {e}"))?;

    let mut rules = Vec::with_capacity(parsed.rules.len());
    for rs in parsed.rules {
      let component_lower = rs.component.as_ref().map(|s| s.to_ascii_lowercase());
      let mut patterns = Vec::with_capacity(rs.patterns.len());
      for ps in rs.patterns {
        match ps.kind {
          PatternKind::Substr => patterns.push(LoadedPattern {
            kind: PatternKind::Substr,
            value_lower: Some(ps.value.to_ascii_lowercase()),
            regex: None,
          }),
          PatternKind::Regex => {
            let re = Regex::new(&ps.value)
              .map_err(|e| format!("Invalid regex in rule {}: {e}", rs.code))?;
            patterns.push(LoadedPattern {
              kind: PatternKind::Regex,
              value_lower: None,
              regex: Some(re),
            });
          }
        }
      }
      rules.push(LoadedRule {
        code: rs.code,
        component_lower,
        applies_to: rs.applies_to,
        patterns,
      });
    }

    Ok(Self {
      rules,
      fallback_code: parsed.fallback_code,
    })
  }

  fn match_code(&self, level: &DiagnosticLevel, component: Option<&str>, msg: &str) -> &str {
    let msg_lower = msg.to_ascii_lowercase();
    let comp_lower = component.map(str::to_ascii_lowercase);

    for r in &self.rules {
      match r.applies_to {
        AppliesTo::Error if !matches!(level, DiagnosticLevel::Error) => continue,
        AppliesTo::Warning if !matches!(level, DiagnosticLevel::Warning) => continue,
        _ => {}
      }

      if let Some(rule_comp) = &r.component_lower {
        match &comp_lower {
          Some(c) if c != rule_comp => continue,
          None => continue,
          _ => {}
        }
      }

      for p in &r.patterns {
        match p.kind {
          PatternKind::Substr => {
            if let Some(needle) = &p.value_lower {
              if msg_lower.contains(needle) {
                return &r.code;
              }
            }
          }
          PatternKind::Regex => {
            if let Some(re) = &p.regex {
              if re.is_match(msg) {
                return &r.code;
              }
            }
          }
        }
      }
    }

    &self.fallback_code
  }
}

pub struct YtdlpErrorParser {
  id: String,
  group_id: String,
  matcher: DiagnosticMatcher,
}

impl YtdlpErrorParser {
  pub fn new(id: &str, group_id: &str, matcher: DiagnosticMatcher) -> Self {
    Self {
      id: id.into(),
      group_id: group_id.into(),
      matcher,
    }
  }

  pub fn parse_lines(&self, lines: Vec<&str>) -> Vec<DiagnosticEvent> {
    let mut events = Vec::with_capacity(lines.len());
    for line in lines {
      if let Some(event) = self.parse_line(line) {
        events.push(event);
      }
    }
    events
  }

  pub fn parse_line(&self, line: &str) -> Option<DiagnosticEvent> {
    let trimmed = line.trim_end();

    if let Some(event) = self.parse_skip_line(trimmed) {
      return Some(event);
    }

    let (level, rest) = if let Some(msg) = trimmed.strip_prefix("ERROR:") {
      (DiagnosticLevel::Error, msg.trim())
    } else if let Some(msg) = trimmed.strip_prefix("WARNING:") {
      (DiagnosticLevel::Warning, msg.trim())
    } else {
      return None;
    };

    let (component, rest) = split_component(rest);
    let (_video_id, message) = split_video_id(rest.as_ref());

    let code = self
      .matcher
      .match_code(&level, component.as_deref(), &message)
      .to_string();

    Some(DiagnosticEvent {
      id: self.id.clone(),
      group_id: self.group_id.clone(),
      level,
      code,
      component,
      message: message.into_owned(),
      raw: trimmed.to_string(),
      timestamp: SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0),
    })
  }

  fn parse_skip_line(&self, line: &str) -> Option<DiagnosticEvent> {
    let message = normalize_skip_message(line)?;

    Some(DiagnosticEvent {
      id: self.id.clone(),
      group_id: self.group_id.clone(),
      level: DiagnosticLevel::Warning,
      code: INPUT_FILTER_SKIPPED_CODE.to_string(),
      component: Some("download".to_string()),
      message,
      raw: line.to_string(),
      timestamp: SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0),
    })
  }
}

fn normalize_skip_message(line: &str) -> Option<String> {
  let trimmed = line.trim();
  let lower = trimmed.to_ascii_lowercase();

  if lower.contains("upload date is not in range") {
    return Some("Skipped by upload date filter".to_string());
  }

  if lower.contains("file is larger than max-filesize") {
    return Some("Skipped by maximum filesize filter".to_string());
  }

  if lower.contains("file is smaller than min-filesize") {
    return Some("Skipped by minimum filesize filter".to_string());
  }

  if lower.contains("does not pass filter") {
    if lower.contains("break-match") {
      return Some("Skipped by break-match filter".to_string());
    }
    return Some("Skipped by advanced input filter".to_string());
  }

  if lower.contains("maximum number of downloads reached")
    || lower.contains("max downloads reached")
  {
    return Some("Skipped by maximum downloads filter".to_string());
  }

  if lower.contains("skipping") && lower.contains("age limit") || lower.contains("age restricted") {
    return Some("Skipped by age limit filter".to_string());
  }

  if lower.contains("skipping") && lower.contains("filter") {
    return Some("Skipped by input filter".to_string());
  }

  if lower.contains(" is not in range ") {
    return Some("Skipped by input filter".to_string());
  }

  if !lower.starts_with("[download] ") && !lower.contains("skipping") {
    return None;
  }

  None
}

fn split_component(s: &'_ str) -> (Option<String>, Cow<'_, str>) {
  if let Some(rest) = s.strip_prefix('[') {
    if let Some(end) = rest.find(']') {
      let comp = rest[..end].to_string();
      let msg = rest[end + 1..].trim();
      return (Some(comp), Cow::Borrowed(msg));
    }
  }
  (None, Cow::Borrowed(s))
}

fn split_video_id(s: &str) -> (Option<String>, Cow<'_, str>) {
  let mut parts = s.splitn(2, ':');
  let first = parts.next().unwrap_or("").trim();
  let rest = parts.next();

  if let Some(msg) = rest {
    if is_probable_id(first) {
      return (Some(first.to_string()), Cow::Borrowed(msg.trim()));
    }
  }

  (None, Cow::Borrowed(s.trim()))
}

fn is_probable_id(s: &str) -> bool {
  let len = s.len();
  (10..=15).contains(&len)
    && s
      .chars()
      .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
  use super::*;

  fn parser() -> YtdlpErrorParser {
    YtdlpErrorParser::new(
      "item-id",
      "group-id",
      DiagnosticMatcher::from_json(r#"{"rules":[],"fallbackCode":"unknown"}"#).unwrap(),
    )
  }

  #[test]
  fn parses_upload_date_skip_lines_as_warnings() {
    let event = parser()
      .parse_line("[download] 2022-01-05 upload date is not in range 2026-06-18 to 9999-12-31")
      .unwrap();

    assert!(matches!(event.level, DiagnosticLevel::Warning));
    assert_eq!(event.code, INPUT_FILTER_SKIPPED_CODE);
    assert_eq!(event.message, "Skipped by upload date filter");
    assert_eq!(event.component.as_deref(), Some("download"));
  }

  #[test]
  fn normalizes_advanced_filter_skip_lines() {
    let event = parser()
      .parse_line("[download] Video does not pass filter (!is_live), skipping ..")
      .unwrap();

    assert_eq!(event.message, "Skipped by advanced input filter");
  }

  #[test]
  fn normalizes_filesize_skip_lines() {
    let event = parser()
      .parse_line("[download] File is larger than max-filesize (123 > 100), skipping")
      .unwrap();

    assert_eq!(event.message, "Skipped by maximum filesize filter");
  }

  #[test]
  fn ignores_non_skip_download_lines() {
    assert!(parser()
      .parse_line("[download] Destination: /tmp/video.mp4")
      .is_none());
  }

  #[test]
  fn normalizes_plain_break_match_filter_rejection_lines() {
    let event = parser()
      .parse_line("Some title does not pass filter (duration <? 1), skipping ..")
      .unwrap();

    assert_eq!(event.code, INPUT_FILTER_SKIPPED_CODE);
    assert_eq!(event.message, "Skipped by advanced input filter");
  }
}
