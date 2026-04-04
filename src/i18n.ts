import { createI18n, I18n } from 'vue-i18n';
import en from './locales/en.json';
import es from './locales/es.json';
import nl from './locales/nl.json';
import it from './locales/it.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import nb from './locales/nb.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import ptPT from './locales/pt-PT.json';
import ptBR from './locales/pt-BR.json';
import zhTW from './locales/zh-TW.json';
import { detectBrowserLanguageCodes } from './helpers/subtitles/languages.ts';

export const availableLocales = {
  en: true,
  es: true,
  nl: true,
  it: true,
  fr: true,
  de: true,
  nb: true,
  ru: true,
  tr: true,
  'pt-PT': true,
  'pt-BR': true,
  'zh-TW': true,
} as const;

type MessageSchema = typeof en;
export type Locale = keyof typeof availableLocales;

const localeAliases: Record<string, Locale> = {
  pt: 'pt-PT',
  'pt-PT': 'pt-PT',
  'pt-BR': 'pt-BR',
  zh: 'zh-TW',
  'zh-Hant': 'zh-TW',
  'zh-TW': 'zh-TW',
  no: 'nb',
  'nb-NO': 'nb',
};

export function getDefaultLocale(): Locale {
  for (const code of detectBrowserLanguageCodes()) {
    if (code in availableLocales) {
      return code as Locale;
    }

    if (code in localeAliases) {
      return localeAliases[code];
    }

    const baseCode = code.split('-')[0];
    if (baseCode in availableLocales) {
      return baseCode as Locale;
    }

    if (baseCode in localeAliases) {
      return localeAliases[baseCode];
    }
  }

  return 'en';
}

export const i18n: I18n = createI18n<[MessageSchema], Locale>({
  locale: getDefaultLocale(),
  legacy: false,
  globalInjection: false,
  fallbackLocale: 'en',
  messages: {
    en,
    es,
    nl,
    it,
    fr,
    de,
    nb,
    ru,
    tr,
    'pt-PT': ptPT,
    'pt-BR': ptBR,
    'zh-TW': zhTW,
  },
});