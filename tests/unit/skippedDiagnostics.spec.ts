import { describe, expect, it } from 'vitest';
import {
  countSkippedDiagnostics,
  groupSkippedDiagnostics,
  INPUT_FILTER_SKIPPED_CODE,
  isSkippedDiagnostic,
} from '../../src/helpers/skippedDiagnostics.ts';

const createDiagnostic = (overrides: Partial<MediaDiagnostic> = {}): MediaDiagnostic => ({
  id: 'id',
  groupId: 'group',
  level: 'warning',
  code: INPUT_FILTER_SKIPPED_CODE,
  component: 'download',
  message: 'Skipped by upload date filter',
  raw: '[download] example',
  timestamp: 1,
  ...overrides,
});

describe('skipped diagnostics helpers', () => {
  it('detects skipped diagnostics by code', () => {
    expect(isSkippedDiagnostic(createDiagnostic())).toBe(true);
    expect(isSkippedDiagnostic(createDiagnostic({ code: 'other_warning' }))).toBe(false);
  });

  it('counts skipped diagnostics only', () => {
    expect(countSkippedDiagnostics([
      createDiagnostic(),
      createDiagnostic({ id: 'two' }),
      createDiagnostic({ id: 'three', code: 'other_warning' }),
    ])).toBe(2);
  });

  it('groups skipped diagnostics by normalized message', () => {
    expect(groupSkippedDiagnostics([
      createDiagnostic(),
      createDiagnostic({ id: 'two' }),
      createDiagnostic({ id: 'three', message: 'Skipped by maximum filesize filter' }),
      createDiagnostic({ id: 'four', code: 'other_warning', message: 'Other warning' }),
    ])).toEqual([
      {
        count: 2,
        diagnostics: [
          createDiagnostic(),
          createDiagnostic({ id: 'two' }),
        ],
        message: 'Skipped by upload date filter',
      },
      {
        count: 1,
        diagnostics: [
          createDiagnostic({ id: 'three', message: 'Skipped by maximum filesize filter' }),
        ],
        message: 'Skipped by maximum filesize filter',
      },
    ]);
  });
});
