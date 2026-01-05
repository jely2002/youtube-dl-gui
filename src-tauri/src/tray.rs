use crate::i18n::I18nManager;
use crate::models::payloads::ShortcutPayload;
use crate::SharedConfig;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconId};
use tauri::{AppHandle, Emitter, Manager};

pub struct TrayState {
  pub tray: Mutex<Option<TrayIconId>>,
}

pub fn create_tray(app: &AppHandle) {
  let tray_state = app.state::<TrayState>();
  let mut guard = tray_state.tray.lock().unwrap();

  if guard.is_some() {
    return;
  }

  let cfg_handle = app.state::<SharedConfig>();
  let cfg = cfg_handle.load();
  if !cfg.system.tray_enabled {
    return;
  }

  let i18n_handle = app.state::<I18nManager>();

  let quit_i = match MenuItem::with_id(app, "quit", i18n_handle.t("tray.quit"), true, None::<&str>)
  {
    Ok(i) => i,
    Err(e) => {
      tracing::warn!("Failed to create quit menu item: {e}");
      return;
    }
  };

  let hide_toggle_i = match MenuItem::with_id(
    app,
    "hide_toggle",
    i18n_handle.t("tray.showOrHide"),
    true,
    None::<&str>,
  ) {
    Ok(i) => i,
    Err(e) => {
      tracing::warn!("Failed to create hide toggle menu item: {e}");
      return;
    }
  };

  let add_to_queue_i = match MenuItem::with_id(
    app,
    "add_to_queue",
    i18n_handle.t("tray.addToQueue"),
    true,
    Some(i18n_handle.t("tray.shortcuts.ctrlShiftV")),
  ) {
    Ok(i) => i,
    Err(e) => {
      tracing::warn!("Failed to create add_to_queue menu item: {e}");
      return;
    }
  };

  let download_i = match MenuItem::with_id(
    app,
    "download",
    i18n_handle.t("tray.downloadQueue"),
    true,
    Some(i18n_handle.t("tray.shortcuts.ctrlShiftEnter")),
  ) {
    Ok(i) => i,
    Err(e) => {
      tracing::warn!("Failed to create download menu item: {e}");
      return;
    }
  };

  let menu = match MenuBuilder::new(app)
    .item(&add_to_queue_i)
    .item(&download_i)
    .separator()
    .item(&hide_toggle_i)
    .item(&quit_i)
    .build()
  {
    Ok(m) => m,
    Err(e) => {
      tracing::warn!("Failed to build tray menu: {e}");
      return;
    }
  };

  let tray = match TrayIconBuilder::new()
    .menu(&menu)
    .icon(app.default_window_icon().unwrap().clone())
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id.as_ref() {
      "quit" => app.exit(0),

      "hide_toggle" => {
        if let Some(window) = app.get_webview_window("main") {
          let _ = if window.is_visible().unwrap_or(false) {
            window.hide()
          } else {
            window.show()
          };
        }
      }

      "add_to_queue" => {
        let _ = app.emit(
          "shortcut_action",
          ShortcutPayload {
            action: "media_add",
          },
        );
      }

      "download" => {
        let _ = app.emit(
          "shortcut_action",
          ShortcutPayload {
            action: "download_all",
          },
        );
      }

      _ => {}
    })
    .build(app)
  {
    Ok(t) => t,
    Err(e) => {
      tracing::warn!("Failed to create tray icon: {e}");
      return;
    }
  };

  #[cfg(target_os = "windows")]
  {
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};

    tray.on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.unminimize();
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    });
  }

  *guard = Some(tray.id().clone());
}

pub fn destroy_tray(app: &AppHandle) {
  let tray_state = app.state::<TrayState>();
  let mut guard = tray_state.tray.lock().unwrap();

  let tray_id = guard.take();
  if let Some(tray_id) = tray_id {
    let _ = app.remove_tray_by_id::<TrayIconId>(&tray_id);
  } else {
    tracing::warn!("No tray icon found to remove");
  }
}
