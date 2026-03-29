import { describe, expect, it } from 'vitest';
import { formatDuration } from '../../src/composables/useDuration';

describe('useDuration helpers', () => {
  it('formats fractional durations without leaking float precision', () => {
    expect(formatDuration(2463.8)).toBe('41:03');
  });
});
