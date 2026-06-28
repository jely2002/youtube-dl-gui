import { describe, expect, it } from 'vitest';
import {
  applyDatePreset,
  buildPlaylistItemsSpec,
  createDefaultInputFilterSettings,
  isInputFiltersActive,
  normalizeInputFilterSettings,
  settingsToInputFilterOverride,
} from '../../src/helpers/inputFilters.ts';
import { defaultSettings, type Settings } from '../../src/tauri/types/config.ts';

describe('input filter helpers', () => {
  it('normalizes structured inputs', () => {
    const normalized = normalizeInputFilterSettings({
      ...createDefaultInputFilterSettings(),
      minSize: {
        value: 50,
        unit: 'MB',
      },
      maxSize: {
        value: -10,
        unit: 'GB',
      },
      dateFilter: {
        mode: 'before',
        value: ' 2026-06-20 ',
      },
      playlistSelection: {
        rows: [
          { id: 'single', type: 'single', index: 4 },
          { id: 'range', type: 'range', start: 1, end: 5, step: 2 },
        ],
      },
      matchFilters: '  !is_live  ',
    });

    expect(normalized.minSize).toEqual({ value: 50, unit: 'MB' });
    expect(normalized.maxSize).toEqual({ value: null, unit: null });
    expect(normalized.dateFilter).toEqual({ mode: 'before', value: '2026-06-20' });
    expect(normalized.playlistSelection.rows).toEqual([
      { id: 'single', type: 'single', index: 4 },
      { id: 'range', type: 'range', start: 1, end: 5, step: null },
    ]);
    expect(normalized.matchFilters).toBe('!is_live');
  });

  it('reports active state for non-default filters', () => {
    expect(isInputFiltersActive(createDefaultInputFilterSettings())).toBe(false);
    expect(isInputFiltersActive({
      ...createDefaultInputFilterSettings(),
      maxDownloads: 5,
    })).toBe(true);
  });

  it('builds playlist item specs from structured rows', () => {
    expect(buildPlaylistItemsSpec({
      rows: [
        { id: 'single', type: 'single', index: 7 },
        { id: 'range-a', type: 'range', start: 1, end: 10, step: null },
        { id: 'reverse', type: 'range', start: -8, end: -2, step: null },
      ],
    })).toBe('7,1:10,-8:-2');
  });

  it('builds an exact queue snapshot override from structured settings', () => {
    const settings: Settings = {
      ...defaultSettings,
      inputFilters: {
        ...createDefaultInputFilterSettings(),
        playlistSelection: {
          rows: [
            { id: 'range', type: 'range', start: 1, end: 3, step: null },
          ],
        },
        minSize: {
          value: 50,
          unit: 'MB',
        },
        dateFilter: {
          mode: 'after',
          value: '2026-06-01',
        },
        maxDownloads: 7,
      },
    };

    expect(settingsToInputFilterOverride(settings)).toEqual({
      playlistItems: '1:3',
      minFilesize: '50M',
      dateafter: '20260601',
      maxDownloads: 7,
    });
  });

  it('maps date presets to structured filters', () => {
    expect(applyDatePreset('today', new Date('2026-06-21T13:45:00Z'))).toEqual({
      mode: 'exact',
      value: '2026-06-21',
    });
    expect(applyDatePreset('last7Days', new Date('2026-06-21T13:45:00Z'))).toEqual({
      mode: 'after',
      value: '2026-06-14',
    });
  });
});
