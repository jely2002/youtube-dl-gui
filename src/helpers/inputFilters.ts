import {
  defaultInputFilterDateFilter,
  defaultInputFilterSettings,
  defaultInputFilterSizeFilter,
  type Settings,
  type InputFilterDateFilter,
  type InputFilterDateMode,
  type InputFilterPlaylistRow,
  type InputFilterPlaylistSelection,
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

export type InputFilterDatePreset = typeof INPUT_FILTER_DATE_PRESETS[number];

export function cloneInputFilterSettings(
  value: InputFilterSettings,
): InputFilterSettings {
  return {
    playlistSelection: clonePlaylistSelection(value.playlistSelection),
    minSize: cloneSizeFilter(value.minSize),
    maxSize: cloneSizeFilter(value.maxSize),
    dateFilter: cloneDateFilter(value.dateFilter),
    ageLimit: value.ageLimit ?? null,
    maxDownloads: value.maxDownloads ?? null,
    matchFilters: value.matchFilters ?? null,
    breakMatchFilters: value.breakMatchFilters ?? null,
  };
}

export function createDefaultInputFilterSettings(): InputFilterSettings {
  return {
    ...defaultInputFilterSettings,
    playlistSelection: clonePlaylistSelection(defaultInputFilterSettings.playlistSelection),
    minSize: cloneSizeFilter(defaultInputFilterSizeFilter),
    maxSize: cloneSizeFilter(defaultInputFilterSizeFilter),
    dateFilter: cloneDateFilter(defaultInputFilterDateFilter),
  };
}

export function normalizeInputFilterSettings(
  value: InputFilterSettings | undefined,
): InputFilterSettings {
  return {
    playlistSelection: normalizePlaylistSelection(value?.playlistSelection),
    minSize: normalizeSizeFilter(value?.minSize),
    maxSize: normalizeSizeFilter(value?.maxSize),
    dateFilter: normalizeDateFilter(value?.dateFilter),
    ageLimit: normalizeWholeNumber(value?.ageLimit ?? null, { min: 0 }),
    maxDownloads: normalizeWholeNumber(value?.maxDownloads ?? null, { min: 1 }),
    matchFilters: normalizeString(value?.matchFilters ?? null),
    breakMatchFilters: normalizeString(value?.breakMatchFilters ?? null),
  };
}

export function isInputFiltersActive(value: InputFilterSettings): boolean {
  const normalized = normalizeInputFilterSettings(value);
  return (
    normalized.playlistSelection.rows.length > 0
    || normalized.minSize.value !== null
    || normalized.maxSize.value !== null
    || normalized.dateFilter.mode !== null
    || normalized.dateFilter.value !== null
    || normalized.ageLimit !== null
    || normalized.maxDownloads !== null
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
    playlistItems: buildPlaylistItemsSpec(normalized.playlistSelection) ?? undefined,
    minFilesize: serializeSizeFilter(normalized.minSize) ?? undefined,
    maxFilesize: serializeSizeFilter(normalized.maxSize) ?? undefined,
    date: dateArgs.date,
    datebefore: dateArgs.datebefore,
    dateafter: dateArgs.dateafter,
    ageLimit: normalized.ageLimit ?? undefined,
    maxDownloads: normalized.maxDownloads ?? undefined,
    matchFilters: normalized.matchFilters ?? undefined,
    breakMatchFilters: normalized.breakMatchFilters ?? undefined,
  };

  return Object.values(result).some(value => value !== undefined) ? result : undefined;
}

export function createPlaylistSelectionRow(type: InputFilterPlaylistRow['type']): InputFilterPlaylistRow {
  const id = createRowId();
  return type === 'single'
    ? { id, type, index: null }
    : { id, type, start: null, end: null, step: null };
}

export function getPlaylistSelectionRowError(row: InputFilterPlaylistRow): string | null {
  if (isPlaylistRowEmpty(row)) {
    return null;
  }

  if (row.type === 'single') {
    return isValidPlaylistIndex(row.index) ? null : 'playlistIndex';
  }

  if (!isValidPlaylistIndex(row.start) || !isValidPlaylistIndex(row.end)) {
    return 'playlistRangeBounds';
  }

  return null;
}

export function buildPlaylistItemsSpec(selection: InputFilterPlaylistSelection): string | null {
  const specs = normalizePlaylistSelection(selection).rows
    .map(row => buildPlaylistRowSpec(row))
    .filter((value): value is string => value !== null);

  return specs.length > 0 ? specs.join(',') : null;
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

function clonePlaylistSelection(value: InputFilterPlaylistSelection | undefined): InputFilterPlaylistSelection {
  return {
    rows: (value?.rows ?? []).map(row => ({ ...row })),
  };
}

function cloneSizeFilter(value: InputFilterSizeFilter | undefined): InputFilterSizeFilter {
  return {
    value: value?.value ?? null,
    unit: value?.unit ?? null,
  };
}

function cloneDateFilter(value: InputFilterDateFilter | undefined): InputFilterDateFilter {
  return {
    mode: value?.mode ?? null,
    value: value?.value ?? null,
  };
}

function normalizePlaylistSelection(
  value: InputFilterPlaylistSelection | undefined,
): InputFilterPlaylistSelection {
  return {
    rows: (value?.rows ?? [])
      .map(row => normalizePlaylistRow(row))
      .filter((row): row is InputFilterPlaylistRow => row !== null && !isPlaylistRowEmpty(row)),
  };
}

function normalizePlaylistRow(row: InputFilterPlaylistRow | undefined): InputFilterPlaylistRow | null {
  if (!row) return null;

  if (row.type === 'single') {
    return {
      id: row.id || createRowId(),
      type: 'single',
      index: normalizePlaylistIndex(row.index),
    };
  }

  return {
    id: row.id || createRowId(),
    type: 'range',
    start: normalizePlaylistIndex(row.start),
    end: normalizePlaylistIndex(row.end),
    step: null,
  };
}

function normalizeSizeFilter(value: InputFilterSizeFilter | undefined): InputFilterSizeFilter {
  const normalizedValue = normalizePositiveNumber(value?.value ?? null);
  const normalizedUnit = INPUT_FILTER_SIZE_UNITS.includes(value?.unit as InputFilterSizeUnit)
    ? value?.unit ?? null
    : null;

  return {
    value: normalizedValue,
    unit: normalizedValue === null ? null : normalizedUnit,
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

function buildPlaylistRowSpec(row: InputFilterPlaylistRow): string | null {
  if (getPlaylistSelectionRowError(row)) {
    return null;
  }

  if (row.type === 'single') {
    return `${row.index}`;
  }

  return `${row.start}:${row.end}`;
}

function isPlaylistRowEmpty(row: InputFilterPlaylistRow): boolean {
  if (row.type === 'single') {
    return row.index == null;
  }

  return row.start == null && row.end == null && row.step == null;
}

function normalizePositiveNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeWholeNumber(
  value: number | null,
  options: { min: number },
): number | null {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= options.min
    ? value
    : null;
}

function normalizePlaylistIndex(value: number | null): number | null {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value !== 0
    ? value
    : null;
}

function isValidPlaylistIndex(value: number | null): boolean {
  return normalizePlaylistIndex(value) !== null;
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

function createRowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Math.random().toString(36).slice(2, 10)}`;
}
