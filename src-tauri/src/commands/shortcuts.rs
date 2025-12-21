use crate::models::payloads::ShortcutPayload;
use crate::SharedConfig;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn register_shortcuts(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let cfg_handle = app_handle.state::<SharedConfig>();
  let cfg = cfg_handle.load();
  if !cfg.input.global_shortcuts {
    return Ok(());
  }

  let mods = Modifiers::CONTROL | Modifiers::SHIFT;
  let add_shortcut = Shortcut::new(Some(mods), Code::KeyV);
  let download_all_shortcut = Shortcut::new(Some(mods), Code::Enter);

  if app_handle.global_shortcut().is_registered(add_shortcut) {
    return Ok(());
  }

  app_handle
    .global_shortcut()
    .on_shortcut(add_shortcut, move |app, _s, e| {
      if e.state() != ShortcutState::Pressed {
        return;
      }
      let _ = app.emit(
        "shortcut_action",
        ShortcutPayload {
          action: "media_add",
        },
      );
    })?;

  app_handle
    .global_shortcut()
    .on_shortcut(download_all_shortcut, move |app, _s, e| {
      if e.state() != ShortcutState::Pressed {
        return;
      }
      let _ = app.emit(
        "shortcut_action",
        ShortcutPayload {
          action: "download_all",
        },
      );
    })?;

  Ok(())
}

pub fn unregister_shortcuts(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  app_handle.global_shortcut().unregister_all()?;
  Ok(())
}
