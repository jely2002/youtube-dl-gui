import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import esRaw from './locales/es.json';
import nlRaw from './locales/nl.json';
import itRaw from './locales/it.json';
import frRaw from './locales/fr.json';
import deRaw from './locales/de.json';
import nbRaw from './locales/nb.json';
import ruRaw from './locales/ru.json';
import trRaw from './locales/tr.json';
import ptBRRaw from './locales/pt-BR.json';
import zhTWRaw from './locales/zh-TW.json';
import { detectBrowserLanguageCodes } from './helpers/subtitles/languages.ts';

export const availableLocales: Record<string, boolean> = {
  'en': true, 'es': true, 'nl': true, 'it': true, 'fr': true, 'de': true, 'nb': true, 'ru': true, 'tr': true, 'pt-BR': true, 'zh-TW': true,
} as const;

type MessageSchema = typeof en;
export type Locale = keyof typeof availableLocales;
const es = esRaw as unknown as MessageSchema;
const nl = nlRaw as unknown as MessageSchema;
const it = itRaw as unknown as MessageSchema;
const fr = frRaw as unknown as MessageSchema;
const de = deRaw as unknown as MessageSchema;
const nb = nbRaw as unknown as MessageSchema;
const ru = ruRaw as unknown as MessageSchema;
const tr = trRaw as unknown as MessageSchema;
const ptBR = ptBRRaw as unknown as MessageSchema;
const zhTW = zhTWRaw as unknown as MessageSchema;

export function getDefaultLocale() {
  const browserLocale = detectBrowserLanguageCodes()[0];
  if (availableLocales[browserLocale]) {
    return browserLocale;
  }
  return 'en';
}

export const i18n = createI18n<[MessageSchema], Locale, false>({
  locale: 'en',
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
    'pt-BR': ptBR,
    'zh-TW': zhTW,
  },
});
