import { describe, it, expect } from 'vitest';
import { formatBytes } from '../../src/helpers/units';

describe('units', () => {
  describe('formatBytes', () => {
    it('formats bytes into human readable string', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
    });
  });
});
