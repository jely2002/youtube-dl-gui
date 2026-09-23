use crate::models::{ParsedMedia, ParsedPlaylist, PlaylistEntry, YtdlpInfo};
use crate::parsers::ytdlp_single::i64_to_u64;

pub fn parse_playlist(info: YtdlpInfo, id: String) -> ParsedMedia {
  let mut entries = Vec::new();

  if let Some(items) = info.entries {
    for (idx, entry) in items.iter().enumerate() {
      let (url, playlist_item) = match (&entry.url, &entry.webpage_url) {
        (Some(url), _) => (url.clone(), None),
        (None, Some(page)) if info.webpage_url.as_ref() != Some(page) => (page.clone(), None),
        // The entry has no URL of its own (e.g. a post with several videos), so fetching
        // its page would return the whole playlist again. Select it from the playlist URL.
        _ => {
          let item = entry
            .playlist_index
            .and_then(|index| u64::try_from(index).ok())
            .unwrap_or(idx as u64 + 1);
          (info.webpage_url.clone().unwrap_or_default(), Some(item))
        }
      };

      if !url.is_empty() {
        entries.push(PlaylistEntry {
          video_url: url,
          index: idx,
          playlist_item,
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
    playlist_count: i64_to_u64(info.playlist_count),
    entries,
  })
}
