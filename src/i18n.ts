import { createI18n, I18n } from 'vue-i18n';
import en from './locales/en.json';
import nl from './locales/nl.json';
import it from './locales/it.json';
import fr from './locales/fr.json';
import ptBR from './locales/pt-BR.json';
import { detectBrowserLanguageCodes } from './helpers/subtitles/languages.ts';

export const availableLocales: Record<string, boolean> = {
  'en': true, 'nl': true, 'it': true, 'fr': true, 'pt-BR': true,
} as const;

type MessageSchema = typeof en;
export type Locale = keyof typeof availableLocales;

export function getDefaultLocale() {
  const browserLocale = detectBrowserLanguageCodes()[0];
  if (availableLocales[browserLocale]) {
    return browserLocale;
  }
  return 'en';
}

export const i18n: I18n = createI18n<[MessageSchema], Locale>({
  locale: 'en',
  legacy: false,
  globalInjection: false,
  fallbackLocale: 'en',
  messages: {
    en,
    nl,
    it,
    fr,
    'pt-BR': ptBR,
  },
});
