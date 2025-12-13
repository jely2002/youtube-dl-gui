use crate::models::{ParsedMedia, ParsedPlaylist, PlaylistEntry, YtdlpInfo};

pub fn parse_playlist(info: YtdlpInfo, id: String) -> ParsedMedia {
  let mut entries = Vec::new();

  if let Some(items) = info.entries {
    for (idx, entry) in items.iter().enumerate() {
      let url = if let Some(u) = &entry.url {
        u.clone()
      } else {
        entry.webpage_url.clone().unwrap_or_default()
      };

      if !url.is_empty() {
        entries.push(PlaylistEntry {
          video_url: url,
          index: idx,
        });
      }
    }
  }

  let thumbnail = info.thumbnails.as_ref().and_then(|thumbs| {
    thumbs
      .iter()
      .max_by_key(|thumb| {
        let w = thumb.width.unwrap_or(0);
        let h = thumb.height.unwrap_or(0);
        w * h
      })
      .and_then(|thumb| thumb.url.clone())
  });

  ParsedMedia::Playlist(ParsedPlaylist {
    id,
    url: info.webpage_url,
    title: info.title,
    thumbnail,
    uploader: info.uploader,
    uploader_id: info.uploader_id,
    playlist_id: info.id,
    playlist_count: info.playlist_count,
    entries,
  })
}
