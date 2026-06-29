import { describe, expect, it } from 'vitest';
import {
  applyPlaylistSelectionToEntries,
  buildPlaylistItemsSpec,
  normalizePlaylistSelection,
} from '../../src/helpers/playlistSelection.ts';

const entries = Array.from({ length: 12 }, (_, index) => ({
  index: index + 1,
  videoUrl: `https://example.com/watch?v=${index + 1}`,
}));

describe('playlist selection helpers', () => {
  it('normalizes rows and removes empty values', () => {
    expect(normalizePlaylistSelection({
      rows: [
        { id: 'single', type: 'single', index: 4.8 },
        { id: 'empty', type: 'range', start: null, end: null },
        { id: 'range', type: 'range', start: 1, end: 5 },
      ],
    })).toEqual({
      rows: [
        { id: 'single', type: 'single', index: 4 },
        { id: 'range', type: 'range', start: 1, end: 5 },
      ],
    });
  });

  it('builds playlist item specs from structured rows', () => {
    expect(buildPlaylistItemsSpec({
      rows: [
        { id: 'single', type: 'single', index: 7 },
        { id: 'range-a', type: 'range', start: 1, end: 3 },
        { id: 'reverse', type: 'range', start: -4, end: -2 },
      ],
    })).toBe('7,1:3,-4:-2');
  });

  it('applies single and range selection locally', () => {
    expect(applyPlaylistSelectionToEntries(entries, {
      rows: [
        { id: 'single', type: 'single', index: 7 },
        { id: 'range', type: 'range', start: 1, end: 3 },
      ],
    }).map(entry => entry.index)).toEqual([7, 1, 2, 3]);
  });

  it('supports negative indexes and reverse ranges', () => {
    expect(applyPlaylistSelectionToEntries(entries, {
      rows: [
        { id: 'single', type: 'single', index: -1 },
        { id: 'range', type: 'range', start: -2, end: -4 },
      ],
    }).map(entry => entry.index)).toEqual([12, 11, 10, 9]);
  });

  it('uses the full playlist when no rows are configured', () => {
    expect(applyPlaylistSelectionToEntries(entries, { rows: [] }).map(entry => entry.index)).toEqual(
      entries.map(entry => entry.index),
    );
  });
});
