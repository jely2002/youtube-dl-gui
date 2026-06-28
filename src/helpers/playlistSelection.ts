import type { EntryItem } from '../tauri/types/media.ts';

export interface PlaylistSelectionSingleRow {
  id: string;
  type: 'single';
  index: number | null;
}

export interface PlaylistSelectionRangeRow {
  id: string;
  type: 'range';
  start: number | null;
  end: number | null;
}

export type PlaylistSelectionRow = PlaylistSelectionSingleRow | PlaylistSelectionRangeRow;

export interface PlaylistSelection {
  rows: PlaylistSelectionRow[];
}

export function createPlaylistSelectionRow(type: PlaylistSelectionRow['type']): PlaylistSelectionRow {
  const id = createRowId();
  return type === 'single'
    ? { id, type, index: null }
    : { id, type, start: null, end: null };
}

export function clonePlaylistSelection(value: PlaylistSelection | undefined): PlaylistSelection {
  return {
    rows: (value?.rows ?? []).map(row => ({ ...row })),
  };
}

export function normalizePlaylistSelection(value: PlaylistSelection | undefined): PlaylistSelection {
  return {
    rows: (value?.rows ?? [])
      .map(row => normalizePlaylistRow(row))
      .filter((row): row is PlaylistSelectionRow => row !== null && !isPlaylistRowEmpty(row)),
  };
}

export function getPlaylistSelectionRowError(row: PlaylistSelectionRow): string | null {
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

export function buildPlaylistItemsSpec(selection: PlaylistSelection): string | null {
  const specs = normalizePlaylistSelection(selection).rows
    .map(row => buildPlaylistRowSpec(row))
    .filter((value): value is string => value !== null);

  return specs.length > 0 ? specs.join(',') : null;
}

export function applyPlaylistSelectionToEntries(
  entries: EntryItem[],
  selection: PlaylistSelection,
): EntryItem[] {
  const normalized = normalizePlaylistSelection(selection);
  if (normalized.rows.length === 0) {
    return [...entries];
  }

  const seenIndexes = new Set<number>();
  const selected: EntryItem[] = [];

  for (const row of normalized.rows) {
    for (const entry of getEntriesForRow(entries, row)) {
      if (seenIndexes.has(entry.index)) continue;
      seenIndexes.add(entry.index);
      selected.push(entry);
    }
  }

  return selected;
}

function normalizePlaylistRow(row: PlaylistSelectionRow | undefined): PlaylistSelectionRow | null {
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
  };
}

function buildPlaylistRowSpec(row: PlaylistSelectionRow): string | null {
  if (getPlaylistSelectionRowError(row)) {
    return null;
  }

  if (row.type === 'single') {
    return `${row.index}`;
  }

  return `${row.start}:${row.end}`;
}

function getEntriesForRow(entries: EntryItem[], row: PlaylistSelectionRow): EntryItem[] {
  if (getPlaylistSelectionRowError(row)) {
    return [];
  }

  if (row.type === 'single') {
    const resolved = resolvePlaylistPosition(entries.length, row.index);
    return resolved === null ? [] : [entries[resolved]].filter(Boolean) as EntryItem[];
  }

  const start = resolvePlaylistPosition(entries.length, row.start);
  const end = resolvePlaylistPosition(entries.length, row.end);
  if (start === null || end === null) {
    return [];
  }

  const selected: EntryItem[] = [];
  const step = start <= end ? 1 : -1;
  for (let index = start; step > 0 ? index <= end : index >= end; index += step) {
    const entry = entries[index];
    if (entry) {
      selected.push(entry);
    }
  }
  return selected;
}

function resolvePlaylistPosition(length: number, value: number | null): number | null {
  if (value == null || value === 0) return null;

  const position = value > 0 ? value - 1 : length + value;
  if (position < 0 || position >= length) {
    return null;
  }

  return position;
}

function isPlaylistRowEmpty(row: PlaylistSelectionRow): boolean {
  return row.type === 'single'
    ? row.index == null
    : row.start == null && row.end == null;
}

function isValidPlaylistIndex(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value !== 0;
}

function normalizePlaylistIndex(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.trunc(value);
  return rounded === 0 ? null : rounded;
}

function createRowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Math.random().toString(36).slice(2, 10)}`;
}
