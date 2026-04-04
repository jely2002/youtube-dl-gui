import ISO6391 from 'iso-639-1';

export interface SubtitleLanguageOption {
  code: string;
  englishName: string;
  nativeName: string;
}

const codes = ISO6391.getAllCodes();

const expandedCodes: Record<string, SubtitleLanguageOption> = {
  'pt-PT': { code: 'pt-PT', englishName: 'Portuguese (Portugal)', nativeName: 'Português (Portugal)' },
  'pt-BR': { code: 'pt-BR', englishName: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  'zh-TW': { code: 'zh-TW', englishName: 'Traditional Chinese (Taiwan)', nativeName: '繁體中文（台灣）' },
};

export const languageOptions: SubtitleLanguageOption[] = [...codes, ...Object.keys(expandedCodes)]
  .map((code) => {
    if (expandedCodes[code]) return expandedCodes[code];

    return {
      code,
      englishName: ISO6391.getName(code),
      nativeName: ISO6391.getNativeName(code),
    };
  })
  .sort((a, b) => a.englishName.localeCompare(b.englishName));

export const languageOptionsLookup = new Map(
  languageOptions.map((option) => [option.code, option] as const),
);

function normalizeLocale(candidate: string): string {
  const parts = candidate.replace(/_/g, '-').split('-');
  const language = parts[0]?.toLowerCase();
  const region = parts[1]?.toUpperCase();

  return region ? `${language}-${region}` : language;
}

export function detectBrowserLanguageCodes(): string[] {
  let candidates = navigator?.languages ?? [];
  if (candidates.length === 0 && navigator?.language) {
    candidates = [navigator.language];
  }

  const normalized = new Set<string>();

  for (const candidate of candidates ?? []) {
    if (!candidate) continue;

    const locale = normalizeLocale(candidate);

    if (expandedCodes[locale]) {
      normalized.add(locale);
    }

    const isoCode = locale.split('-')[0];
    if (isoCode && ISO6391.validate(isoCode)) {
      normalized.add(isoCode);
    }
  }

  return Array.from(normalized);
}