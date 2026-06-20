import { describe, expect, it } from 'vitest';
import { resolvePlaylistIndex } from '../../src/helpers/playlistNumbering';

describe('playlist numbering', () => {
  it('converts stored playlist indices to 1-based numbering', () => {
    expect(resolvePlaylistIndex(0, 10, false)).toBe(1);
    expect(resolvePlaylistIndex(9, 10, false)).toBe(10);
  });

  it('reverses numbering when enabled and count is known', () => {
    expect(resolvePlaylistIndex(0, 10, true)).toBe(10);
    expect(resolvePlaylistIndex(9, 10, true)).toBe(1);
    expect(resolvePlaylistIndex(4, 10, true)).toBe(6);
  });

  it('falls back to normal numbering when the playlist count is missing', () => {
    expect(resolvePlaylistIndex(2, undefined, true)).toBe(3);
  });

  it('returns undefined when the playlist index is missing', () => {
    expect(resolvePlaylistIndex(undefined, 10, true)).toBeUndefined();
  });
});
