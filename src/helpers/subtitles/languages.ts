import ISO6391 from 'iso-639-1';

export interface SubtitleLanguageOption {
  code: string;
  englishName: string;
  nativeName: string;
}

const codes = ISO6391.getAllCodes();
const expanded_codes: Record<string, SubtitleLanguageOption> = {
  'pt-BR': { code: 'pt-BR', englishName: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  'zh-TW': { code: 'zh-TW', englishName: 'Traditional Chinese (Taiwan)', nativeName: '繁體中文（台灣）' },
};

export const languageOptions: SubtitleLanguageOption[] = [...codes, ...Object.keys(expanded_codes)]
  .map((code) => {
    if (expanded_codes[code]) return expanded_codes[code];

    const englishName = ISO6391.getName(code);
    const nativeName = ISO6391.getNativeName(code);

    return {
      code,
      englishName,
      nativeName,
    };
  })
  .sort((a, b) => a.englishName.localeCompare(b.englishName));

export const languageOptionsLookup = new Map(
  languageOptions.map(option => [option.code, option] as const),
);

export function getSubtitleLanguageLabel(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) {
    return code;
  }

  const normalized = trimmed.replace('_', '-');
  const lower = normalized.toLowerCase();
  const isOrig = lower.endsWith('-orig');
  const base = isOrig ? normalized.slice(0, -5) : normalized;
  const exact = languageOptionsLookup.get(base)
    || languageOptionsLookup.get(base.toLowerCase());
  const label = exact?.englishName ?? normalized.toUpperCase();

  return isOrig ? `${label} (Original audio)` : label;
}

export function getPreferredAutoSubtitleLanguages(codes: string[]): string[] {
  const groups = new Map<string, { plain?: string; orig?: string }>();

  for (const code of codes) {
    const trimmed = code.trim();
    if (!trimmed) continue;

    const normalized = trimmed.replace('_', '-');
    const lower = normalized.toLowerCase();
    const isOrig = lower.endsWith('-orig');
    const base = (isOrig ? normalized.slice(0, -5) : normalized).toLowerCase();
    const existing = groups.get(base) ?? {};

    if (isOrig) existing.orig = lower;
    else existing.plain = lower;

    groups.set(base, existing);
  }

  const hasOrigVariant = [...groups.values()].some(value => value.orig);

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([, value]) => !hasOrigVariant || value.orig)
    .map(([, value]) => value.plain ?? value.orig!)
    .filter(Boolean);
}

export function detectBrowserLanguageCodes(): string[] {
  let candidates = navigator?.languages ?? [];
  if (candidates.length === 0) {
    candidates = [navigator.language];
  }

  const normalized = new Set<string>();

  for (const candidate of candidates ?? []) {
    if (!candidate) {
      continue;
    }

    const isoCode = candidate.split('-')[0]?.toLowerCase();
    if (isoCode && ISO6391.validate(isoCode)) {
      normalized.add(isoCode);
    }
  }

  return Array.from(normalized);
}
