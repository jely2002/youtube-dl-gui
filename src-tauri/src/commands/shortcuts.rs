use crate::models::payloads::ShortcutPayload;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{
  Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};

pub fn register_shortcuts(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  #[cfg(target_os = "macos")]
  let mods = Modifiers::META | Modifiers::ALT;

  #[cfg(not(target_os = "macos"))]
  let mods = Modifiers::CONTROL | Modifiers::ALT;

  let add_shortcut = Shortcut::new(Some(mods), Code::KeyV);
  let download_all_shortcut = Shortcut::new(Some(mods), Code::Enter);

  let add_shortcut_c = add_shortcut.clone();
  let download_all_shortcut_c = download_all_shortcut.clone();

  app_handle.plugin(
    tauri_plugin_global_shortcut::Builder::new()
      .with_handler(move |app, shortcut, event: ShortcutEvent| {
        if event.state() != ShortcutState::Pressed {
          return;
        }

        let action = if shortcut == &add_shortcut_c {
          Some("media_add")
        } else if shortcut == &download_all_shortcut_c {
          Some("download_all")
        } else {
          None
        };

        if let Some(action) = action {
          let _ = app.emit("shortcut_action", ShortcutPayload { action });
        }
      })
      .build(),
  )?;

  app_handle.global_shortcut().register(add_shortcut)?;
  app_handle
    .global_shortcut()
    .register(download_all_shortcut)?;

  Ok(())
}
