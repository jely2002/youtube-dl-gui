export const DEFAULT_SUBTITLE_FORMAT_ORDER = ['srt', 'vtt', 'ass', 'ttml', 'json'] as const;
const DEFAULT_LANGUAGES = ['en'];

const pushUnique = (target: string[], seen: Set<string>, value: string) => {
  if (!seen.has(value)) {
    seen.add(value);
    target.push(value);
  }
};

export function sanitizeSubtitleFormats(formats: string[]): string[] {
  const normalizedInputs: string[] = [];
  const seenInputs = new Set<string>();

  for (const raw of formats) {
    const value = raw.trim().toLowerCase();
    if (!value) {
      continue;
    }

    if (!seenInputs.has(value)) {
      seenInputs.add(value);
      normalizedInputs.push(value);
    }
  }

  const primary
    = normalizedInputs.find(value => DEFAULT_SUBTITLE_FORMAT_ORDER.includes(value as typeof DEFAULT_SUBTITLE_FORMAT_ORDER[number]))
      ?? normalizedInputs[0]
      ?? DEFAULT_SUBTITLE_FORMAT_ORDER[0];

  const ordered: string[] = [];
  const seen = new Set<string>();

  pushUnique(ordered, seen, primary);

  for (const fallback of DEFAULT_SUBTITLE_FORMAT_ORDER) {
    pushUnique(ordered, seen, fallback);
  }

  for (const extra of normalizedInputs) {
    pushUnique(ordered, seen, extra);
  }

  return ordered;
}

export function sanitizeSubtitleLanguages(languages: string[]): string[] {
  if (
    languages.some(language => language.trim().toLowerCase() === 'all')
  ) {
    return ['all'];
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const raw of languages) {
    const value = raw.trim();
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      sanitized.push(key);
    }
  }

  return sanitized.length ? sanitized : [...DEFAULT_LANGUAGES];
}
