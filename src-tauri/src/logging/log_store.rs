use crate::models::payloads::AppendLogPayload;
use indexmap::IndexMap;
use std::collections::{HashSet, VecDeque};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Default)]
pub struct GroupLog {
  lines: VecDeque<String>,
  bytes: usize,
}

#[derive(Debug)]
pub struct LogStore {
  groups: IndexMap<String, GroupLog>,
  total_bytes: usize,
  max_bytes: usize,
  subscribed: HashSet<String>,
}

impl LogStore {
  pub fn new(max_bytes: usize) -> Self {
    Self {
      groups: IndexMap::new(),
      total_bytes: 0,
      max_bytes,
      subscribed: HashSet::new(),
    }
  }

  pub fn subscribe(&mut self, group_id: String) {
    self.subscribed.insert(group_id);
  }

  pub fn unsubscribe(&mut self, group_id: &str) {
    self.subscribed.remove(group_id);
  }

  pub fn append_lines<'a, I>(&mut self, app: &AppHandle, group: &str, lines: I)
  where
    I: IntoIterator<Item = &'a str>,
  {
    for line in lines {
      self.append_line(app, group, line);
    }
  }

  pub fn append_line(&mut self, app: &AppHandle, group_id: &str, line: &str) {
    let line_len = line.len();

    let entry = self.groups.entry(group_id.to_string()).or_default();

    entry.bytes += line_len;
    entry.lines.push_back(line.to_owned());
    self.total_bytes += line_len;

    if self.subscribed.contains(group_id) {
      let payload = AppendLogPayload {
        group_id: group_id.to_string(),
        line: line.to_owned(),
      };

      if let Err(err) = app.emit("logging_append", &payload) {
        tracing::debug!("Failed to emit log event: {err}");
      }
    }

    self.evict_if_needed();
  }

  pub fn get_log(&self, group_id: &String) -> Option<String> {
    let group = self.groups.get(group_id)?;
    let mut out = String::with_capacity(group.bytes + group.lines.len());

    for (idx, line) in group.lines.iter().enumerate() {
      out.push_str(line);

      if !line.ends_with('\n') && idx + 1 < group.lines.len() {
        out.push('\n');
      }
    }

    Some(out)
  }

  pub fn remove_group(&mut self, group_id: &String) {
    if let Some(old) = self.groups.shift_remove(group_id) {
      self.total_bytes = self.total_bytes.saturating_sub(old.bytes);
    }
    self.subscribed.remove(group_id);
  }

  fn evict_if_needed(&mut self) {
    while self.total_bytes > self.max_bytes {
      if let Some((old_id, old_log)) = self.groups.shift_remove_index(0) {
        self.total_bytes = self.total_bytes.saturating_sub(old_log.bytes);
        self.subscribed.remove(&old_id);
      } else {
        break;
      }
    }
  }
}
