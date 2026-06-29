use crate::models::TrackType;
use crate::runners::template_context::TemplateContext;
use crate::state::config_models::OutputSettings;
use crate::state::preferences_models::PathPreferences;
use std::path::PathBuf;

pub fn build_location_args(
  track_type: &TrackType,
  template_context: &TemplateContext,
  output_settings: &OutputSettings,
  path_preferences: &PathPreferences,
  fallback_dir: PathBuf,
) -> Vec<String> {
  let global_dir = output_settings
    .download_dir
    .as_ref()
    .map(PathBuf::from)
    .unwrap_or(fallback_dir);

  let (preferred_dir, prefix_dir, filename) = match track_type {
    TrackType::Both | TrackType::Video => (
      path_preferences.video_download_dir.as_ref(),
      path_preferences.video_directory_template.as_str(),
      output_settings.file_name_template.as_str(),
    ),
    TrackType::Audio => (
      path_preferences.audio_download_dir.as_ref(),
      path_preferences.audio_directory_template.as_str(),
      output_settings.audio_file_name_template.as_str(),
    ),
  };

  let base_dir = preferred_dir
    .map(PathBuf::from)
    .unwrap_or_else(|| global_dir.clone());

  let output_path = base_dir.join(prefix_dir).join(filename);
  let rendered_output = template_context.render_template(output_path.to_string_lossy().as_ref());

  vec!["-o".into(), rendered_output]
}
