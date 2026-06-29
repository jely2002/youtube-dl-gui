import { describe, expect, it } from 'vitest';
import {
  applyDatePreset,
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
      matchFilters: '  !is_live  ',
    });

    expect(normalized.minSize).toEqual({ value: 50, unit: 'MB' });
    expect(normalized.maxSize).toEqual({ value: null, unit: 'GB' });
    expect(normalized.dateFilter).toEqual({ mode: 'before', value: '2026-06-20' });
    expect(normalized.matchFilters).toBe('!is_live');
  });

  it('reports active state for non-default filters', () => {
    expect(isInputFiltersActive(createDefaultInputFilterSettings())).toBe(false);
    expect(isInputFiltersActive({
      ...createDefaultInputFilterSettings(),
      matchFilters: '!is_live',
    })).toBe(true);
  });

  it('builds an exact queue snapshot override from structured settings', () => {
    const settings: Settings = {
      ...defaultSettings,
      inputFilters: {
        ...createDefaultInputFilterSettings(),
        minSize: {
          value: 50,
          unit: 'MB',
        },
        dateFilter: {
          mode: 'after',
          value: '2026-06-01',
        },
      },
    };

    expect(settingsToInputFilterOverride(settings)).toEqual({
      minFilesize: '50M',
      dateafter: '20260601',
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
