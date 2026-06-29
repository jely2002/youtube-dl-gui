import { isValidUrl } from './url.ts';
import { i18n } from '../i18n';
import { ToastStyle } from '../stores/toast.ts';

export type ParsedUrlImport = {
  urls: string[];
  skipped: number;
};

export type UrlImportToast = {
  message: string;
  style: ToastStyle;
};

const URL_MATCHER = /https?:\/\/[^\s<>"'`]+/gi;

function unique(urls: string[]): string[] {
  return [...new Set(urls)];
}

function normalizeUrlCandidate(value: string): string {
  return value.trim().replace(/[),.;!?]+$/g, '');
}

export function parseUrlInputText(text: string): ParsedUrlImport {
  const tokens = text
    .split(/[\s,]+/)
    .map(token => token.trim())
    .filter(Boolean);

  const urls = unique(tokens.filter(token => isValidUrl(token)));
  const skipped = tokens.filter(token => !isValidUrl(token)).length;

  return { urls, skipped };
}

export function parseUrlFileText(text: string): ParsedUrlImport {
  const matches = text.match(URL_MATCHER) ?? [];
  const urls = unique(
    matches
      .map(normalizeUrlCandidate)
      .filter(candidate => isValidUrl(candidate)),
  );

  const skipped = text
    .split(/[\s,]+/)
    .map(token => token.trim())
    .filter(token => token.startsWith('http://') || token.startsWith('https://'))
    .filter(token => !isValidUrl(normalizeUrlCandidate(token)))
    .length;

  return { urls, skipped };
}

export function isSupportedImportFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.csv') || lowerName.endsWith('.txt');
}

export function mergeParsedUrlImports(results: ParsedUrlImport[]): ParsedUrlImport {
  return {
    urls: unique(results.flatMap(result => result.urls)),
    skipped: results.reduce((sum, result) => sum + result.skipped, 0),
  };
}

export function getUrlImportToast(result: ParsedUrlImport): UrlImportToast {
  const t = i18n.global.t;

  if (result.urls.length === 0) {
    return {
      message: t('common.urlImport.noneFound'),
      style: 'warning',
    };
  }

  if (result.skipped > 0) {
    return {
      message: t('common.urlImport.partial', { added: result.urls.length, skipped: result.skipped }),
      style: 'info',
    };
  }

  return {
    message: t('common.urlImport.added', result.urls.length),
    style: 'info',
  };
}

export function getUrlImportReadErrorToast(): UrlImportToast {
  return {
    message: i18n.global.t('common.urlImport.readError'),
    style: 'error',
  };
}
