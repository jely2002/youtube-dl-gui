import { describe, expect, it } from 'vitest';
import { mergeParsedUrlImports, parseUrlFileText, parseUrlInputText } from '../../src/helpers/urlImport.ts';

describe('urlImport', () => {
  it('parses multiple input urls separated by commas, whitespace, and newlines', () => {
    const result = parseUrlInputText(
      'https://example.com/a, https://example.com/b\nhttps://example.com/c\tinvalid',
    );

    expect(result.urls).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
    ]);
    expect(result.skipped).toBe(1);
  });

  it('extracts urls from csv-like file content', () => {
    const result = parseUrlFileText(
      'title,url\nExample,https://example.com/watch?v=1\nTwo,https://example.com/watch?v=2',
    );

    expect(result.urls).toEqual([
      'https://example.com/watch?v=1',
      'https://example.com/watch?v=2',
    ]);
  });

  it('deduplicates merged imports', () => {
    const result = mergeParsedUrlImports([
      { urls: ['https://example.com/a', 'https://example.com/b'], skipped: 1 },
      { urls: ['https://example.com/b', 'https://example.com/c'], skipped: 2 },
    ]);

    expect(result.urls).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
    ]);
    expect(result.skipped).toBe(3);
  });
});
