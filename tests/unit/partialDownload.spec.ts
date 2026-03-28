import { describe, expect, it } from 'vitest';
import {
  buildDownloadSectionsValues,
  createDefaultSection,
  normalizeTimestampInput,
  toPartialDownloadPayload,
  validateSelection,
} from '../../src/helpers/partialDownload';

describe('partial download helpers', () => {
  it('normalizes flexible time formats to HH:MM:SS', () => {
    expect(normalizeTimestampInput('90')).toBe('00:01:30');
    expect(normalizeTimestampInput('1:30')).toBe('00:01:30');
    expect(normalizeTimestampInput('01:30')).toBe('00:01:30');
    expect(normalizeTimestampInput('00:01:30')).toBe('00:01:30');
  });

  it('rejects invalid time formats', () => {
    expect(normalizeTimestampInput('1:99')).toBeNull();
    expect(normalizeTimestampInput('a:b')).toBeNull();
    expect(normalizeTimestampInput('')).toBeNull();
  });

  it('creates a default section from the media duration when available', () => {
    expect(createDefaultSection('p1', 125)).toEqual({
      id: 'p1',
      start: '00:00:00',
      end: '00:02:05',
    });
    expect(createDefaultSection('p2')).toEqual({
      id: 'p2',
      start: '00:00:00',
      end: '',
    });
  });

  it('floors fractional media durations when creating the default section', () => {
    expect(createDefaultSection('p3', 2463.8)).toEqual({
      id: 'p3',
      start: '00:00:00',
      end: '00:41:03',
    });
  });

  it('validates ordering and duration bounds', () => {
    expect(validateSelection({ start: '00:01:00', end: '00:00:30' })).toEqual({
      start: null,
      end: 'beforeStart',
    });
    expect(validateSelection({ start: '00:03:00', end: '00:03:10' }, 120)).toEqual({
      start: 'exceedsDuration',
      end: null,
    });
  });

  it('keeps only the first valid section for the yt-dlp download sections value', () => {
    const payload = toPartialDownloadPayload([
      { id: 'a', start: '90', end: '165' },
      { id: 'b', start: '00:05:00', end: '00:06:10' },
    ]);

    expect(payload).toEqual({
      section: { id: 'a', start: '00:01:30', end: '00:02:45' },
    });
    expect(buildDownloadSectionsValues(payload?.section)).toEqual([
      '*00:01:30-00:02:45',
    ]);
  });

  it('suppresses sections when any section is invalid', () => {
    const payload = toPartialDownloadPayload([
      { id: 'a', start: '00:01:30', end: 'bad' },
    ]);

    expect(payload).toEqual({
      section: undefined,
    });
  });
});
