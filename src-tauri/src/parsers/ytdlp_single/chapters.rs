use crate::models::ytdlp::YtdlpChapter;
use crate::models::Chapter;

pub(super) fn process_chapters(chapters: Option<&[YtdlpChapter]>) -> Vec<Chapter> {
  chapters
    .unwrap_or_default()
    .iter()
    .filter_map(|chapter| {
      let title = chapter.title.as_ref()?.trim();
      let start_time = chapter.start_time?;
      let end_time = chapter.end_time?;
      if title.is_empty() || end_time <= start_time {
        return None;
      }

      Some(Chapter {
        title: title.to_string(),
        start_time,
        end_time,
      })
    })
    .collect()
}

#[cfg(test)]
mod tests {
  use super::process_chapters;
  use crate::models::ytdlp::YtdlpChapter;

  #[test]
  fn filters_invalid_chapters() {
    let chapters = vec![
      YtdlpChapter {
        title: Some("Intro".into()),
        start_time: Some(0.0),
        end_time: Some(25.0),
      },
      YtdlpChapter {
        title: Some("".into()),
        start_time: Some(25.0),
        end_time: Some(50.0),
      },
      YtdlpChapter {
        title: Some("Main".into()),
        start_time: Some(25.0),
        end_time: Some(120.0),
      },
    ];

    let processed = process_chapters(Some(&chapters));

    assert_eq!(processed.len(), 2);
    assert_eq!(processed[0].title, "Intro");
    assert_eq!(processed[1].title, "Main");
  }
}
