use crate::state::config_models::NotificationBehavior;
use crate::SharedConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum NotificationKind {
  QueueAdded,
  QueueDownloading,
  QueueFinished,
  VideoFinished,
  PlaylistFinished,
  VideoReady,
  PlaylistReady,
  DownloadFailed,
}

impl NotificationKind {
  fn kind_str(&self) -> &'static str {
    match self {
      Self::QueueAdded => "queueAdded",
      Self::QueueDownloading => "queueDownloading",
      Self::QueueFinished => "queueFinished",
      Self::VideoFinished => "videoFinished",
      Self::PlaylistFinished => "playlistFinished",
      Self::VideoReady => "videoReady",
      Self::PlaylistReady => "playlistReady",
      Self::DownloadFailed => "downloadFailed",
    }
  }

  #[inline]
  pub fn title_key(&self) -> String {
    format!("notifications.{}.title", self.kind_str())
  }

  #[inline]
  pub fn body_key(&self) -> String {
    format!("notifications.{}.body", self.kind_str())
  }
}

#[tauri::command]
pub fn notify(
  app: AppHandle,
  cfg: State<'_, SharedConfig>,
  i18n: State<'_, crate::i18n::I18nManager>,
  kind: NotificationKind,
  params: Option<HashMap<String, String>>,
  force: bool,
) -> Result<(), String> {
  let cfg_handle = cfg.load();
  if cfg_handle
    .notifications
    .disabled_notifications
    .contains(&kind)
  {
    return Ok(());
  }
  match cfg_handle.notifications.notification_behavior {
    NotificationBehavior::Always => {}
    NotificationBehavior::Never => return Ok(()),
    NotificationBehavior::OnBackground => {
      if let Some(window) = app.get_window("main") {
        if (window.is_visible().unwrap_or(false) || window.is_focused().unwrap_or(false)) && !force
        {
          return Ok(());
        }
      }
    }
  }

  let title = i18n.t_with(&kind.title_key(), params.as_ref());
  let body = i18n.t_with(&kind.body_key(), params.as_ref());

  #[cfg(target_os = "linux")]
  {
    use notify_rust::Notification;

    let handle = Notification::new()
      .summary(title.as_str())
      .body(body.as_str())
      .icon("open-video-downloader")
      .show()
      .map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
      handle.on_close(|_| {});
    });
  }

  #[cfg(not(target_os = "linux"))]
  {
    use tauri_plugin_notification::NotificationExt;

    app
      .notification()
      .builder()
      .title(title)
      .body(body)
      .show()
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}
