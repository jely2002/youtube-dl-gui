import {
  defaultInputFilterDateFilter,
  defaultInputFilterSettings,
  defaultInputFilterSizeFilter,
  type Settings,
  type InputFilterDateFilter,
  type InputFilterDateMode,
  type InputFilterSettings,
  type InputFilterSizeFilter,
  type InputFilterSizeUnit,
} from '../tauri/types/config.ts';
import {
  type DownloadOverrides,
  type InputFilterOptions,
} from '../tauri/types/media.ts';

export const INPUT_FILTER_SIZE_UNITS: InputFilterSizeUnit[] = ['B', 'KB', 'MB', 'GB', 'TB'];
export const INPUT_FILTER_DATE_MODES: InputFilterDateMode[] = ['exact', 'before', 'after'];
export const INPUT_FILTER_DATE_PRESETS = ['today', 'yesterday', 'last7Days', 'last30Days'] as const;
const DEFAULT_INPUT_FILTER_SIZE_UNIT: InputFilterSizeUnit = 'MB';

export type InputFilterDatePreset = typeof INPUT_FILTER_DATE_PRESETS[number];

export function cloneInputFilterSettings(
  value: InputFilterSettings,
): InputFilterSettings {
  return {
    minSize: cloneSizeFilter(value.minSize),
    maxSize: cloneSizeFilter(value.maxSize),
    dateFilter: cloneDateFilter(value.dateFilter),
    matchFilters: value.matchFilters ?? null,
    breakMatchFilters: value.breakMatchFilters ?? null,
  };
}

export function createDefaultInputFilterSettings(): InputFilterSettings {
  return {
    ...defaultInputFilterSettings,
    minSize: cloneSizeFilter(defaultInputFilterSizeFilter),
    maxSize: cloneSizeFilter(defaultInputFilterSizeFilter),
    dateFilter: cloneDateFilter(defaultInputFilterDateFilter),
  };
}

export function normalizeInputFilterSettings(
  value: InputFilterSettings | undefined,
): InputFilterSettings {
  return {
    minSize: normalizeSizeFilter(value?.minSize),
    maxSize: normalizeSizeFilter(value?.maxSize),
    dateFilter: normalizeDateFilter(value?.dateFilter),
    matchFilters: normalizeString(value?.matchFilters ?? null),
    breakMatchFilters: normalizeString(value?.breakMatchFilters ?? null),
  };
}

export function isInputFiltersActive(value: InputFilterSettings): boolean {
  const normalized = normalizeInputFilterSettings(value);
  return (
    normalized.minSize.value !== null
    || normalized.maxSize.value !== null
    || normalized.dateFilter.mode !== null
    || normalized.dateFilter.value !== null
    || normalized.matchFilters !== null
    || normalized.breakMatchFilters !== null
  );
}

export function settingsToInputFilterOverride(
  settings: Settings,
): DownloadOverrides['inputFilters'] | undefined {
  const normalized = normalizeInputFilterSettings(settings.inputFilters);
  const dateArgs = buildDateArgs(normalized.dateFilter);

  const result: InputFilterOptions = {
    minFilesize: serializeSizeFilter(normalized.minSize) ?? undefined,
    maxFilesize: serializeSizeFilter(normalized.maxSize) ?? undefined,
    date: dateArgs.date,
    datebefore: dateArgs.datebefore,
    dateafter: dateArgs.dateafter,
    matchFilters: normalized.matchFilters ?? undefined,
    breakMatchFilters: normalized.breakMatchFilters ?? undefined,
  };

  return Object.values(result).some(value => value !== undefined) ? result : undefined;
}

export function applyDatePreset(
  preset: InputFilterDatePreset,
  now: Date = new Date(),
): InputFilterDateFilter {
  const reference = toUtcDate(now);
  switch (preset) {
    case 'today':
      return { mode: 'exact', value: formatDateInput(reference) };
    case 'yesterday':
      return { mode: 'exact', value: formatDateInput(addDays(reference, -1)) };
    case 'last7Days':
      return { mode: 'after', value: formatDateInput(addDays(reference, -7)) };
    case 'last30Days':
      return { mode: 'after', value: formatDateInput(addDays(reference, -30)) };
  }
}

function cloneSizeFilter(value: InputFilterSizeFilter | undefined): InputFilterSizeFilter {
  return {
    value: value?.value ?? null,
    unit: INPUT_FILTER_SIZE_UNITS.includes(value?.unit as InputFilterSizeUnit)
      ? value?.unit ?? DEFAULT_INPUT_FILTER_SIZE_UNIT
      : DEFAULT_INPUT_FILTER_SIZE_UNIT,
  };
}

function cloneDateFilter(value: InputFilterDateFilter | undefined): InputFilterDateFilter {
  return {
    mode: value?.mode ?? null,
    value: value?.value ?? null,
  };
}

function normalizeSizeFilter(value: InputFilterSizeFilter | undefined): InputFilterSizeFilter {
  const normalizedValue = normalizePositiveNumber(value?.value ?? null);
  const normalizedUnit = INPUT_FILTER_SIZE_UNITS.includes(value?.unit as InputFilterSizeUnit)
    ? value?.unit ?? DEFAULT_INPUT_FILTER_SIZE_UNIT
    : DEFAULT_INPUT_FILTER_SIZE_UNIT;

  return {
    value: normalizedValue,
    unit: normalizedUnit,
  };
}

function normalizeDateFilter(value: InputFilterDateFilter | undefined): InputFilterDateFilter {
  const mode = INPUT_FILTER_DATE_MODES.includes(value?.mode as InputFilterDateMode)
    ? value?.mode ?? null
    : null;
  const normalizedValue = normalizeDateInput(value?.value ?? null);

  return {
    mode: normalizedValue ? mode : null,
    value: normalizedValue && mode ? normalizedValue : null,
  };
}

function buildDateArgs(dateFilter: InputFilterDateFilter): {
  date?: string;
  datebefore?: string;
  dateafter?: string;
} {
  const value = dateFilter.value ? dateFilter.value.replaceAll('-', '') : undefined;
  if (!value || !dateFilter.mode) {
    return {};
  }

  switch (dateFilter.mode) {
    case 'exact':
      return { date: value };
    case 'before':
      return { datebefore: value };
    case 'after':
      return { dateafter: value };
  }
}

function serializeSizeFilter(filter: InputFilterSizeFilter): string | null {
  if (filter.value === null || filter.unit === null) return null;
  return `${formatNumber(filter.value)}${sizeUnitSuffix(filter.unit)}`;
}

function normalizePositiveNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeString(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDateInput(value: string | null): string | null {
  const normalized = normalizeString(value);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`.replace(/\.?0+$/, '');
}

function sizeUnitSuffix(unit: InputFilterSizeUnit): string {
  switch (unit) {
    case 'B':
      return 'B';
    case 'KB':
      return 'K';
    case 'MB':
      return 'M';
    case 'GB':
      return 'G';
    case 'TB':
      return 'T';
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function formatDateInput(date: Date): string {
  return [
    date.getUTCFullYear(),
    `${date.getUTCMonth() + 1}`.padStart(2, '0'),
    `${date.getUTCDate()}`.padStart(2, '0'),
  ].join('-');
}
