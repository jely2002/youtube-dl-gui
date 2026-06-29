use crate::models::download::{InputFilterOptions, PlaylistMode};

pub fn build_input_filter_args(input_filters: Option<&InputFilterOptions>) -> Vec<String> {
  let Some(input_filters) = input_filters else {
    return Vec::new();
  };

  let mut args = Vec::new();

  push_value_arg(&mut args, "-I", input_filters.playlist_items.as_deref());
  push_value_arg(
    &mut args,
    "--min-filesize",
    input_filters.min_filesize.as_deref(),
  );
  push_value_arg(
    &mut args,
    "--max-filesize",
    input_filters.max_filesize.as_deref(),
  );
  push_value_arg(&mut args, "--date", input_filters.date.as_deref());
  push_value_arg(
    &mut args,
    "--datebefore",
    input_filters.datebefore.as_deref(),
  );
  push_value_arg(&mut args, "--dateafter", input_filters.dateafter.as_deref());

  push_value_arg(
    &mut args,
    "--match-filters",
    input_filters.match_filters.as_deref(),
  );
  push_value_arg(
    &mut args,
    "--break-match-filters",
    input_filters.break_match_filters.as_deref(),
  );

  match input_filters.playlist_mode {
    Some(PlaylistMode::SingleVideo) => args.push("--no-playlist".into()),
    Some(PlaylistMode::Playlist) => args.push("--yes-playlist".into()),
    None => {}
  }

  args
}

fn push_value_arg(args: &mut Vec<String>, flag: &str, value: Option<&str>) {
  let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
    return;
  };
  args.push(flag.into());
  args.push(value.into());
}
