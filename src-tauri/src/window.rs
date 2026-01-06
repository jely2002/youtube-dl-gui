use crate::state::json_merge;
use crate::SharedPreferences;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::{
  AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Window, WindowEvent, Wry,
};
use tokio::sync::Mutex;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowPreferencesPatch {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub width: Option<u32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub height: Option<u32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub x: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub y: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub prev_x: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub prev_y: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub maximized: Option<bool>,
}

impl WindowPreferencesPatch {
  pub fn empty() -> Self {
    Self {
      width: None,
      height: None,
      x: None,
      y: None,
      prev_x: None,
      prev_y: None,
      maximized: None,
    }
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesPatch {
  pub window: WindowPreferencesPatch,
}

struct DebouncedPatch {
  pending: Value,
  task: Option<JoinHandle<()>>,
}

#[derive(Clone)]
struct PatchDebouncer {
  inner: Arc<Mutex<DebouncedPatch>>,
  delay: Duration,
  app: AppHandle<Wry>,
}

impl PatchDebouncer {
  fn new(app: AppHandle<Wry>, delay: Duration) -> Self {
    Self {
      inner: Arc::new(Mutex::new(DebouncedPatch {
        pending: Value::Object(Default::default()),
        task: None,
      })),
      delay,
      app,
    }
  }

  async fn push(&self, patch: Value) {
    let mut g = self.inner.lock().await;

    json_merge(&mut g.pending, &patch);

    if let Some(t) = g.task.take() {
      t.abort();
    }

    let inner = self.inner.clone();
    let app = self.app.clone();
    let delay = self.delay;

    g.task = Some(tauri::async_runtime::spawn(async move {
      tokio::time::sleep(delay).await;

      let to_flush = {
        let mut g = inner.lock().await;
        let v = std::mem::replace(&mut g.pending, Value::Object(Default::default()));
        g.task = None;
        v
      };

      if to_flush.as_object().map(|o| o.is_empty()).unwrap_or(false) {
        return;
      }

      let prefs = match app.try_state::<SharedPreferences>() {
        Some(h) => h,
        None => {
          tracing::warn!("PreferencesHandle not available during debounced flush");
          return;
        }
      };

      if let Err(e) = prefs.apply_patch(&to_flush, &app) {
        tracing::warn!("Failed to persist debounced window patch: {e}");
      }
    }));
  }

  async fn flush_now(&self) {
    let to_flush = {
      let mut g = self.inner.lock().await;
      if let Some(t) = g.task.take() {
        t.abort();
      }
      std::mem::replace(&mut g.pending, Value::Object(Default::default()))
    };

    if to_flush.as_object().map(|o| o.is_empty()).unwrap_or(false) {
      return;
    }

    let prefs = match self.app.try_state::<SharedPreferences>() {
      Some(h) => h,
      None => {
        tracing::warn!("PreferencesHandle not available during immediate flush");
        return;
      }
    };

    if let Err(e) = prefs.apply_patch(&to_flush, &self.app) {
      tracing::warn!("Failed to persist window patch (flush_now): {e}");
    }
  }
}

pub fn restore_main_window(app: &AppHandle<Wry>) {
  let prefs_handle = match app.try_state::<SharedPreferences>() {
    Some(h) => h,
    None => {
      tracing::warn!("PreferencesHandle not available, skipping window restore");
      return;
    }
  };

  let window = match app.get_window("main") {
    Some(w) => w,
    None => {
      tracing::warn!("Main window not found, skipping window restore");
      return;
    }
  };

  let prefs = prefs_handle.load();
  let s = &prefs.window;

  let (rx, ry) = if s.maximized {
    (s.prev_x, s.prev_y)
  } else {
    (s.x, s.y)
  };

  let has_size = s.width > 0 && s.height > 0;

  let ok_to_apply_position = if has_size {
    window_rect_is_on_some_monitor(&window, rx, ry, s.width, s.height).unwrap_or_else(|e| {
      tracing::warn!("Monitor check failed, skipping window position restore: {e}");
      false
    })
  } else {
    true
  };

  if has_size {
    if let Err(e) = window.set_size(PhysicalSize::new(s.width, s.height)) {
      tracing::warn!("Failed to restore window size: {e}");
    }
  }

  if ok_to_apply_position {
    if let Err(e) = window.set_position(PhysicalPosition::new(rx, ry)) {
      tracing::warn!("Failed to restore window position: {e}");
    }
  }

  if s.maximized {
    if let Err(e) = window.maximize() {
      tracing::warn!("Failed to restore maximized state: {e}");
    }
  }
}

pub fn track_main_window(app: &AppHandle<Wry>) {
  let window = match app.get_window("main") {
    Some(w) => w,
    None => {
      tracing::warn!("Main window not found, skipping window tracking");
      return;
    }
  };

  let app_handle = app.clone();
  let window_for_events = window.clone();

  let debouncer = PatchDebouncer::new(app_handle.clone(), Duration::from_millis(300));

  window.on_window_event(move |event| {
    let debouncer = debouncer.clone();

    match event {
      WindowEvent::Moved(pos) => {
        if window_for_events.is_maximized().unwrap_or(false) {
          return;
        }

        let patch = PreferencesPatch {
          window: WindowPreferencesPatch {
            x: Some(pos.x),
            y: Some(pos.y),
            prev_x: Some(pos.x),
            prev_y: Some(pos.y),
            ..WindowPreferencesPatch::empty()
          },
        };

        if let Ok(v) = serde_json::to_value(patch) {
          tauri::async_runtime::spawn(async move {
            debouncer.push(v).await;
          });
        }
      }

      WindowEvent::Resized(_) => {
        if window_for_events.is_maximized().unwrap_or(false) {
          return;
        }

        if let Ok(size) = window_for_events.inner_size() {
          let patch = PreferencesPatch {
            window: WindowPreferencesPatch {
              width: Some(size.width),
              height: Some(size.height),
              ..WindowPreferencesPatch::empty()
            },
          };

          if let Ok(v) = serde_json::to_value(patch) {
            tauri::async_runtime::spawn(async move {
              debouncer.push(v).await;
            });
          }
        }
      }

      WindowEvent::CloseRequested { .. } => {
        tauri::async_runtime::spawn(async move {
          debouncer.flush_now().await;
        });
      }

      _ => {}
    }
  });
}

pub fn setup_close_behaviour(app: &AppHandle<Wry>) {
  let app_handle = app.clone();

  let window = match app_handle.get_window("main") {
    Some(w) => w,
    None => {
      tracing::warn!("Main window not found; cannot wire close behavior");
      return;
    }
  };

  let window_for_events = window.clone();

  window.on_window_event(move |event| {
    let WindowEvent::CloseRequested { api, .. } = event else {
      return;
    };

    #[cfg(not(target_os = "macos"))]
    {
      use crate::state::config_models::CloseBehavior;
      use crate::SharedConfig;

      let cfg_handle = match app_handle.try_state::<SharedConfig>() {
        Some(h) => h,
        None => {
          tracing::warn!("Config handle missing; allowing close");
          return;
        }
      };
      let cfg = cfg_handle.load();

      if !cfg.system.tray_enabled {
        return;
      }

      match cfg.system.close_behavior {
        CloseBehavior::Exit => {}
        CloseBehavior::Hide => {
          api.prevent_close();
          if let Err(e) = window_for_events.hide() {
            tracing::warn!("Failed to hide window on close: {e}");
          }
        }
      }
    }

    #[cfg(target_os = "macos")]
    {
      api.prevent_close();
      if let Err(e) = window_for_events.hide() {
        tracing::warn!("Failed to hide window on close: {e}");
      }
    }
  });
}

fn rect_intersects_monitor(x: i32, y: i32, w: u32, h: u32, m: &Monitor) -> bool {
  let mp = *m.position();
  let ms = *m.size();

  let m_left = mp.x;
  let m_top = mp.y;
  let m_right = mp.x + ms.width as i32;
  let m_bottom = mp.y + ms.height as i32;

  let left = x;
  let top = y;
  let right = x + w as i32;
  let bottom = y + h as i32;

  left < m_right && right > m_left && top < m_bottom && bottom > m_top
}

fn window_rect_is_on_some_monitor(
  window: &Window,
  x: i32,
  y: i32,
  w: u32,
  h: u32,
) -> tauri::Result<bool> {
  let monitors = window.available_monitors()?;
  if monitors.is_empty() {
    return Ok(true);
  }

  Ok(
    monitors
      .iter()
      .any(|m| rect_intersects_monitor(x, y, w, h, m)),
  )
}
