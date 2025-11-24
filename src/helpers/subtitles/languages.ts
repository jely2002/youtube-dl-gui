import ISO6391 from 'iso-639-1';

export interface SubtitleLanguageOption {
  code: string;
  englishName: string;
  nativeName: string;
}

const codes = ISO6391.getAllCodes();

export const languageOptions: SubtitleLanguageOption[] = codes
  .map((code) => {
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
