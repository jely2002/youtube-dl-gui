use crate::models::payloads::ShortcutPayload;
use crate::SharedConfig;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn shortcut_mods() -> Modifiers {
  if cfg!(not(target_os = "macos")) {
    Modifiers::ALT | Modifiers::SHIFT
  } else {
    Modifiers::CONTROL | Modifiers::SHIFT
  }
}

pub fn register_shortcuts(app_handle: &AppHandle) {
  let cfg_handle = app_handle.state::<SharedConfig>();
  let cfg = cfg_handle.load();
  if !cfg.input.global_shortcuts {
    return;
  }

  let add_shortcut = Shortcut::new(Some(shortcut_mods()), Code::KeyV);
  let download_all_shortcut = Shortcut::new(Some(shortcut_mods()), Code::Enter);

  let gs = app_handle.global_shortcut();

  if gs.is_registered(add_shortcut) {
    return;
  }

  if let Err(e) = gs.on_shortcut(add_shortcut, move |app, _s, e| {
    if e.state() != ShortcutState::Pressed {
      return;
    }

    let _ = app.emit(
      "shortcut_action",
      ShortcutPayload {
        action: "media_add",
      },
    );
  }) {
    tracing::warn!(error = %e, "Failed to register global shortcut: add-to-queue");
  }

  if let Err(e) = gs.on_shortcut(download_all_shortcut, move |app, _s, e| {
    if e.state() != ShortcutState::Pressed {
      return;
    }

    let _ = app.emit(
      "shortcut_action",
      ShortcutPayload {
        action: "download_all",
      },
    );
  }) {
    tracing::warn!(error = %e, "Failed to register global shortcut: download-all");
  }
}

pub fn unregister_shortcuts(app_handle: &AppHandle) {
  if let Err(e) = app_handle.global_shortcut().unregister_all() {
    tracing::warn!(error = %e, "Failed to unregister global shortcuts");
  }
}
