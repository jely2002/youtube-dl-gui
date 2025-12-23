use regex::{Captures, Regex};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Clone, Debug, Deserialize)]
pub struct TemplateContext {
  pub values: HashMap<String, String>,
}

impl TemplateContext {
  #[allow(dead_code)]
  pub fn insert<K: Into<String>, V: Into<String>>(&mut self, key: K, value: V) {
    self.values.insert(key.into(), value.into());
  }

  pub fn render_template(&self, template: &str) -> String {
    let re = Regex::new(r"%\(([^)]+)\)([0-9.]*[sd])").expect("invalid regex");

    let replaced = re.replace_all(template, |caps: &Captures| {
      let whole = caps.get(0).unwrap().as_str();
      let expr = caps.get(1).unwrap().as_str();
      let fmt = caps.get(2).unwrap().as_str();

      let (field_part, default_part) = match expr.split_once('|') {
        Some((left, default)) => (left, Some(default)),
        None => (expr, None),
      };

      let (fields_part, replacement_part) = match field_part.split_once('&') {
        Some((fields, replacement)) => (fields, Some(replacement)),
        None => (field_part, None),
      };

      let field_specs: Vec<&str> = fields_part
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

      if field_specs.is_empty() {
        return whole.to_string();
      }

      let primary_spec = field_specs[0];
      let primary_key = primary_spec
        .split_once('>')
        .map(|(k, _)| k)
        .unwrap_or(primary_spec)
        .trim();

      let mut any_known_field = false;

      let mut resolved_value: Option<String> = None;
      let mut resolved_index: Option<usize> = None;

      for (idx, field_spec) in field_specs.iter().enumerate() {
        let key = field_spec
          .split_once('>')
          .map(|(k, _)| k)
          .unwrap_or(field_spec)
          .trim();

        if let Some(val) = self.values.get(key) {
          any_known_field = true;

          if !val.is_empty() && resolved_value.is_none() {
            resolved_value = Some(val.clone());
            resolved_index = Some(idx);
          }
        }
      }

      if !any_known_field {
        return whole.to_string();
      }

      if let Some(val) = resolved_value {
        let from_primary = resolved_index == Some(0);

        if from_primary {
          let mut out = if let Some(repl) = replacement_part {
            repl.to_string()
          } else {
            val
          };

          let ty = fmt.chars().last().unwrap_or('s');
          let width_str = &fmt[..fmt.len().saturating_sub(1)];

          if ty == 'd' && !width_str.is_empty() {
            if let Ok(num) = out.trim().parse::<i64>() {
              let pad_zero = width_str.starts_with('0');
              let width: usize = width_str.trim_start_matches('0').parse().unwrap_or(0);
              if width > 0 {
                out = if pad_zero {
                  format!("{num:0width$}")
                } else {
                  format!("{num:width$}")
                };
              }
            }
          }

          return out;
        }

        let mut fallback = val;
        fallback = fallback.replace('|', "_");
        fallback = fallback.replace('\\', "_");
        fallback = fallback.replace('/', "_");

        return format!("%({primary_key}|{fallback}){fmt}");
      }

      default_part.unwrap_or("").to_string()
    });

    replaced.replace("%%", "%")
  }
}

#[cfg(test)]
mod tests {
  use super::TemplateContext;
  use std::collections::HashMap;

  fn create_context(pairs: &[(&str, &str)]) -> TemplateContext {
    let mut ctx = TemplateContext {
      values: HashMap::new(),
    };
    for (k, v) in pairs {
      ctx.insert(*k, *v);
    }
    ctx
  }

  #[test]
  fn non_matching_placeholder_is_left_untouched() {
    use super::TemplateContext;
    use std::collections::HashMap;

    let mut ctx = TemplateContext {
      values: HashMap::new(),
    };

    let out = ctx.render_template("%(title)s");
    assert_eq!(out, "%(title)s");

    let tpl = "%(playlist_index)03d - %(title)s";
    ctx.insert("playlist_index", "5");
    let out2 = ctx.render_template(tpl);

    assert_eq!(out2, "005 - %(title)s");
  }

  #[test]
  fn simple_substitution() {
    let ctx = create_context(&[("title", "My Video")]);

    let out = ctx.render_template("%(title)s");
    assert_eq!(out, "My Video");

    let out2 = ctx.render_template("File: %(title)s.mp4");
    assert_eq!(out2, "File: My Video.mp4");
  }

  #[test]
  fn multiple_field_fallback() {
    let ctx = create_context(&[("title", "Fallback Title"), ("primary", "Primary Value")]);

    let out = ctx.render_template("%(primary,title)s");
    assert_eq!(out, "Primary Value");

    let ctx2 = create_context(&[("title", "Only Title")]);
    let out2 = ctx2.render_template("%(primary,title)s");
    assert_eq!(out2, "%(primary|Only Title)s");
  }

  #[test]
  fn replacement_if_present_without_default() {
    let ctx = create_context(&[("playlist_index", "3")]);

    let out = ctx.render_template("%(playlist_index& - )sTitle");
    assert_eq!(out, " - Title");

    let ctx2 = create_context(&[]);
    let tpl = "%(playlist_index& - )sTitle";
    let out2 = ctx2.render_template(tpl);
    assert_eq!(out2, tpl);
  }

  #[test]
  fn replacement_if_present_with_default() {
    let ctx = create_context(&[("playlist_index", "7")]);

    let out = ctx.render_template("%(playlist_index& - |)sTitle");
    assert_eq!(out, " - Title");
  }

  #[test]
  fn numeric_zero_padded_formatting() {
    let ctx = create_context(&[("playlist_index", "5"), ("title", "My Video")]);

    let out = ctx.render_template("%(playlist_index)03d - %(title)s");
    assert_eq!(out, "005 - My Video");

    let out2 = ctx.render_template("%(playlist_index)2d");
    assert_eq!(out2, " 5");
  }

  #[test]
  fn numeric_formatting_with_non_numeric_value() {
    let ctx = create_context(&[("index", "abc")]);

    let out = ctx.render_template("%(index)03d");
    assert_eq!(out, "abc");
  }

  #[test]
  fn date_style_modifier_is_ignored_but_field_used() {
    let ctx = create_context(&[("upload_date", "20250101")]);

    let out = ctx.render_template("%(upload_date>%Y-%m-%d)s");
    assert_eq!(out, "20250101");
  }

  #[test]
  fn literal_percent_handling() {
    let ctx = create_context(&[("title", "My Video")]);

    let out = ctx.render_template("Progress: 50%% - %(title)s");
    assert_eq!(out, "Progress: 50% - My Video");

    let out2 = ctx.render_template("%%%(title)s%%");
    assert_eq!(out2, "%My Video%");
  }

  #[test]
  fn multiple_occurrences_of_same_field() {
    let ctx = create_context(&[("title", "My Video")]);

    let out = ctx.render_template("%(title)s - %(title)s");
    assert_eq!(out, "My Video - My Video");
  }

  #[test]
  fn mixed_features_realistic_example() {
    let ctx = create_context(&[
      ("playlist_title", "My Playlist"),
      ("playlist_index", "5"),
      ("autonumber", "12"),
    ]);

    let tpl = "%(playlist_title|)s/%(playlist_index)03d - %(title)s.%(ext)s";
    let out = ctx.render_template(tpl);
    assert_eq!(out, "My Playlist/005 - %(title)s.%(ext)s");

    let ctx2 = create_context(&[]);

    let out2 = ctx2.render_template(tpl);
    assert_eq!(out2, tpl);
  }

  #[test]
  fn playlist_count_with_dot_zero_d_is_replaced() {
    let ctx = create_context(&[("playlist_count", "4")]);

    let out = ctx.render_template("%(playlist_count).0d-%(title).200s");
    assert_eq!(out, "4-%(title).200s");
  }

  #[test]
  fn combined_fields_right() {
    let ctx = create_context(&[("playlist_title", "my playlist")]);

    let out = ctx.render_template("%(album,playlist_title).s-%(title).200s");
    assert_eq!(out, "%(album|my playlist).s-%(title).200s");
  }

  #[test]
  fn combined_fields_left() {
    let ctx = create_context(&[("playlist_title", "my playlist")]);

    let out = ctx.render_template("%(playlist_title,album)s-%(title).200s");
    assert_eq!(out, "my playlist-%(title).200s");
  }

  #[test]
  fn combined_fields_center() {
    let ctx = create_context(&[("playlist_title", "my playlist")]);

    let out = ctx.render_template("%(uploader,playlist_title,album)s-%(title).200s");
    assert_eq!(out, "%(uploader|my playlist)s-%(title).200s");
  }

  #[test]
  fn combined_fields_unknown_keeps_placeholder() {
    let ctx = create_context(&[]);
    let out = ctx.render_template("%(album,playlist_title)s-%(title)s");
    assert_eq!(out, "%(album,playlist_title)s-%(title)s");
  }
}
