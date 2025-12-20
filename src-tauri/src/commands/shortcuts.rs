use crate::models::payloads::ShortcutPayload;
use crate::SharedConfig;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{
  Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};

pub fn register_shortcuts(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let mods = Modifiers::CONTROL | Modifiers::SHIFT;

  let add_shortcut = Shortcut::new(Some(mods), Code::KeyV);
  let download_all_shortcut = Shortcut::new(Some(mods), Code::Enter);

  app_handle.plugin(
    tauri_plugin_global_shortcut::Builder::new()
      .with_handler(move |app, shortcut, event: ShortcutEvent| {
        if event.state() != ShortcutState::Pressed {
          return;
        }

        let action = if shortcut == &add_shortcut {
          Some("media_add")
        } else if shortcut == &download_all_shortcut {
          Some("download_all")
        } else {
          None
        };

        if let Some(action) = action {
          let cfg_handle = app.state::<SharedConfig>();
          let cfg = cfg_handle.load();
          if cfg.input.global_shortcuts {
            let _ = app.emit("shortcut_action", ShortcutPayload { action });
          }
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
