use ovd_core::models::payloads::NavigatePayload;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter};

pub fn setup_menu(handle: &AppHandle) {
  #[cfg(target_os = "macos")]
  {
    setup_macos(handle);
  }
  #[cfg(target_os = "windows")]
  {
    setup_windows(handle);
  }
  #[cfg(target_os = "linux")]
  {
    setup_linux(handle);
  }
}

#[allow(dead_code)]
fn setup_macos(handle: &AppHandle) {
  let settings_item = MenuItemBuilder::new("Settings…")
    .id("settings")
    .accelerator("CmdOrCtrl+,")
    .build(handle)
    .expect("Could not build settings item.");

  let app_submenu = SubmenuBuilder::new(handle, "App")
    .about(Some(AboutMetadata {
      name: Some("Open Video Downloader".into()),
      copyright: Some("© Jelle Glebbeek and contributors".into()),
      license: Some("GNU Affero General Public License v3.0".into()),
      website: Some("https://jely2002.github.io/youtube-dl-gui/".into()),
      ..Default::default()
    }))
    .separator()
    .item(&settings_item)
    .separator()
    .services()
    .separator()
    .hide()
    .hide_others()
    .separator()
    .quit()
    .build()
    .expect("Could not build app submenu.");

  let edit_submenu = SubmenuBuilder::new(handle, "Edit")
    .undo()
    .redo()
    .separator()
    .cut()
    .copy()
    .paste()
    .select_all()
    .build()
    .expect("Could not build edit submenu.");

  let menu = MenuBuilder::new(handle)
    .items(&[&app_submenu, &edit_submenu])
    .build()
    .expect("Could not attach submenus to menu.");

  handle.set_menu(menu).expect("Could not attach menu.");
  handle.on_menu_event(move |app, event| {
    if event.id() == settings_item.id() {
      let _ = app.emit(
        "navigate",
        NavigatePayload {
          route: "settings".into(),
        },
      );
    }
  });
}

#[allow(dead_code)]
fn setup_windows(handle: &AppHandle) {
  let menu = MenuBuilder::new(handle)
    .items(&[])
    .build()
    .expect("Could not attach submenus to menu.");

  handle.set_menu(menu).expect("Could not attach menu.");
}

#[allow(dead_code)]
fn setup_linux(handle: &AppHandle) {
  let menu = MenuBuilder::new(handle)
    .items(&[])
    .build()
    .expect("Could not attach submenus to menu.");

  handle.set_menu(menu).expect("Could not attach menu.");
}
