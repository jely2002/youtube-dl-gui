import { describe, it, vi, expect } from 'vitest';
import tauriListeners from '../../src/plugins/tauriListeners';

describe('tauriListeners', () => {
  describe('install', () => {
    it('registers listeners', () => {
      const spy = vi.spyOn(window.__TAURI_INTERNALS__, 'invoke');

      tauriListeners.install();

      expect(spy).toHaveBeenCalledWith('plugin:event|listen', {
        event: 'media_add',
        target: {
          kind: 'Any',
        },
        handler: expect.any(Number),
      }, undefined);
    });
  });
});
