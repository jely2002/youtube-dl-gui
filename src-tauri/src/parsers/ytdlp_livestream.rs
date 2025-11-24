use crate::models::parsed::ParsedLivestream;
use crate::models::{ParsedMedia, YtdlpInfo};

pub fn parse_livestream(info: YtdlpInfo, id: String) -> ParsedMedia {
  ParsedMedia::Livestream(ParsedLivestream {
    id,
    url: info.webpage_url,
    title: info.title,
    uploader: info.uploader,
  })
}
