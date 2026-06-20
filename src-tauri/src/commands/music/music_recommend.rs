use crate::state::config_models::{MusicDnaSeed, MusicDnaSettings};
use crate::stronghold::stronghold_state::StrongholdState;
use crate::SharedConfig;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;

const MUSIC_DNA_API_KEY_PATH: &str = "musicDna.apiKey";
const MAX_REQUESTS_PER_MINUTE: usize = 12;
const MAX_ERROR_BODY_LENGTH: usize = 250;
const DEFAULT_MODEL_TEMPERATURE: f32 = 0.25;
const MAX_RECENT_SEEDS_IN_PROMPT: usize = 5;
const MAX_FEEDBACK_IN_PROMPT: usize = 15;

#[derive(Default)]
pub struct MusicDnaRateLimiter {
  recent: Mutex<VecDeque<Instant>>,
}

impl MusicDnaRateLimiter {
  pub const fn new() -> Self {
    Self {
      recent: Mutex::new(VecDeque::new()),
    }
  }

  pub fn allow(&self, max_per_minute: usize) -> bool {
    let mut guard = self.recent.lock().expect("music dna limiter lock poisoned");
    let now = Instant::now();
    let cutoff = now - Duration::from_secs(60);
    while guard.front().is_some_and(|t| *t < cutoff) {
      let _ = guard.pop_front();
    }
    if guard.len() >= max_per_minute {
      return false;
    }
    guard.push_back(now);
    true
  }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicDnaRequest {
  pub song_url: String,
  pub title: Option<String>,
  pub artist: Option<String>,
  pub description: Option<String>,
  pub duration_seconds: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct MusicDnaApiResponse {
  choices: Vec<MusicDnaChoice>,
}

#[derive(Debug, Clone, Deserialize)]
struct MusicDnaChoice {
  message: MusicDnaMessage,
}

#[derive(Debug, Clone, Deserialize)]
struct MusicDnaMessage {
  content: String,
}

#[derive(Debug, Clone, Deserialize)]
struct MusicDnaRawSuggestions {
  suggestions: Vec<MusicDnaRawSuggestion>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MusicDnaRawSuggestion {
  title: String,
  artist: String,
  url: Option<String>,
  rationale: String,
  confidence: f32,
  #[serde(default)]
  tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicDnaSuggestion {
  pub title: String,
  pub artist: String,
  pub url: Option<String>,
  pub rationale: String,
  pub confidence: f32,
  pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicDnaResponse {
  pub suggestions: Vec<MusicDnaSuggestion>,
  pub low_confidence: bool,
  pub source_model: String,
}

#[tauri::command]
pub async fn music_dna_recommend(
  request: MusicDnaRequest,
  cfg: State<'_, SharedConfig>,
  stronghold: State<'_, StrongholdState>,
  limiter: State<'_, MusicDnaRateLimiter>,
) -> Result<MusicDnaResponse, String> {
  validate_url(&request.song_url)?;

  let settings = cfg.load().music_dna.clone();
  if !settings.enabled {
    return Err(error_code(
      "feature_disabled",
      "Music DNA is disabled in settings.",
    ));
  }

  if !limiter.allow(MAX_REQUESTS_PER_MINUTE) {
    return Err(error_code(
      "rate_limited",
      "Too many Music DNA requests. Please wait a minute and try again.",
    ));
  }

  let api_key = load_api_key(&stronghold)?;
  let endpoint = format!(
    "{}/chat/completions",
    settings.provider_base_url.trim_end_matches('/')
  );
  let system_prompt = build_system_prompt(&settings);
  let user_prompt = build_user_prompt(&request, &settings);
  let body = json!({
    "model": settings.model,
    "temperature": DEFAULT_MODEL_TEMPERATURE,
    "response_format": { "type": "json_object" },
    "messages": [
      { "role": "system", "content": system_prompt },
      { "role": "user", "content": user_prompt }
    ]
  });

  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(settings.timeout_seconds.max(5)))
    .build()
    .map_err(|e| error_code("client_init_failed", e.to_string()))?;

  let payload = request_with_retry(&client, &endpoint, &api_key, body).await?;
  let parsed = parse_suggestions(&payload)?;

  let mut suggestions: Vec<MusicDnaSuggestion> = parsed
    .suggestions
    .into_iter()
    .map(|suggestion| MusicDnaSuggestion {
      title: suggestion.title,
      artist: suggestion.artist,
      url: suggestion.url,
      rationale: suggestion.rationale,
      confidence: suggestion.confidence.clamp(0.0, 1.0),
      tags: suggestion.tags,
    })
    .filter(|item| item.confidence >= settings.min_confidence.clamp(0.0, 1.0))
    .collect();

  suggestions.sort_by(|a, b| b.confidence.total_cmp(&a.confidence));
  suggestions.truncate(settings.max_suggestions.clamp(1, 5));

  let top_confidence = suggestions.first().map_or(0.0, |item| item.confidence);
  Ok(MusicDnaResponse {
    suggestions,
    low_confidence: top_confidence < settings.low_confidence_threshold.clamp(0.0, 1.0),
    source_model: settings.model,
  })
}

fn validate_url(value: &str) -> Result<(), String> {
  let parsed = Url::parse(value).map_err(|e| error_code("invalid_url", e.to_string()))?;
  if parsed.scheme() != "http" && parsed.scheme() != "https" {
    return Err(error_code(
      "invalid_url",
      "Only http and https links are supported.",
    ));
  }
  Ok(())
}

fn load_api_key(stronghold: &State<'_, StrongholdState>) -> Result<String, String> {
  let api_key = stronghold
    .load_secret(MUSIC_DNA_API_KEY_PATH)
    .map_err(|e| error_code("vault_error", e))?
    .filter(|value| !value.trim().is_empty())
    .ok_or_else(|| {
      error_code(
        "missing_api_key",
        "Music DNA API key is missing. Set it in Authentication settings.",
      )
    })?;
  Ok(api_key)
}

async fn request_with_retry(
  client: &reqwest::Client,
  endpoint: &str,
  api_key: &str,
  body: serde_json::Value,
) -> Result<MusicDnaApiResponse, String> {
  let mut last_error: Option<String> = None;

  for attempt in 0..3 {
    let response = client
      .post(endpoint)
      .bearer_auth(api_key)
      .json(&body)
      .send()
      .await;

    match response {
      Ok(resp) => {
        let status = resp.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
          return Err(error_code(
            "provider_rate_limited",
            "SiliconFlow rate limited this request.",
          ));
        }

        if !status.is_success() {
          let body_text = resp.text().await.unwrap_or_default();
          let trimmed = body_text
            .chars()
            .take(MAX_ERROR_BODY_LENGTH)
            .collect::<String>();
          if status.is_server_error() && attempt < 2 {
            tokio::time::sleep(Duration::from_millis(300 * (attempt + 1) as u64)).await;
            continue;
          }
          return Err(error_code(
            "provider_error",
            format!("Provider returned {status}: {trimmed}"),
          ));
        }

        return resp
          .json::<MusicDnaApiResponse>()
          .await
          .map_err(|e| error_code("provider_payload_invalid", e.to_string()));
      }
      Err(error) => {
        last_error = Some(error.to_string());
        if attempt < 2 {
          tokio::time::sleep(Duration::from_millis(300 * (attempt + 1) as u64)).await;
          continue;
        }
      }
    }
  }

  Err(error_code(
    "network_error",
    last_error.unwrap_or_else(|| "Unknown network error.".to_string()),
  ))
}

fn parse_suggestions(payload: &MusicDnaApiResponse) -> Result<MusicDnaRawSuggestions, String> {
  let content = payload
    .choices
    .first()
    .map(|choice| choice.message.content.as_str())
    .ok_or_else(|| {
      error_code(
        "provider_payload_invalid",
        "No response choices were returned.",
      )
    })?;

  let stripped = strip_code_fences(content);
  serde_json::from_str::<MusicDnaRawSuggestions>(&stripped)
    .map_err(|e| error_code("provider_payload_invalid", e.to_string()))
}

fn strip_code_fences(content: &str) -> String {
  let trimmed = content.trim();
  if trimmed.starts_with("```") {
    let without_open = trimmed
      .trim_start_matches("```json")
      .trim_start_matches("```");
    return without_open.trim_end_matches("```").trim().to_string();
  }
  trimmed.to_string()
}

fn build_system_prompt(settings: &MusicDnaSettings) -> String {
  format!(
    concat!(
      "You are a music DNA recommendation engine. ",
      "Return strict JSON object only with this schema: ",
      "{{\"suggestions\":[{{\"title\":\"...\",\"artist\":\"...\",\"url\":\"https://...|null\",",
      "\"rationale\":\"...\",\"confidence\":0.0,\"tags\":[\"...\"]}}]}}. ",
      "Never include markdown. ",
      "Focus genres: {genres}. Target region: {region}. ",
      "Weight profile signals with genre={genre}, region={region_weight}, era={era}, instrumentation={instrumentation}, mood={mood}."
    ),
    genres = settings.focus_genres.join(", "),
    region = settings.target_region,
    genre = settings.weights.genre,
    region_weight = settings.weights.region,
    era = settings.weights.era,
    instrumentation = settings.weights.instrumentation,
    mood = settings.weights.mood,
  )
}

fn build_user_prompt(request: &MusicDnaRequest, settings: &MusicDnaSettings) -> String {
  let seed_history: Vec<MusicDnaSeed> = settings
    .seed_history
    .iter()
    .rev()
    .take(MAX_RECENT_SEEDS_IN_PROMPT)
    .cloned()
    .collect();
  let feedback: Vec<String> = settings
    .feedback_memory
    .iter()
    .rev()
    .take(MAX_FEEDBACK_IN_PROMPT)
    .cloned()
    .collect();

  json!({
    "seed": {
      "url": request.song_url,
      "title": request.title,
      "artist": request.artist,
      "description": request.description,
      "durationSeconds": request.duration_seconds
    },
    "targetRecommendations": settings.max_suggestions.clamp(1, 5),
    "constraints": {
      "targetRegion": settings.target_region,
      "focusGenres": settings.focus_genres
    },
    "recentSeeds": seed_history,
    "feedbackMemory": feedback
  })
  .to_string()
}

fn error_code(code: &str, message: impl Into<String>) -> String {
  format!("music_dna::{code}::{}", message.into())
}
