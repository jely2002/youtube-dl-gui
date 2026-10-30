import { describe, expect, it, vi } from 'vitest';
import '../../src-isolation/main';

describe('dependency diagnostics IPC isolation', () => {
  it('allows the dependency status command through the production isolation hook', () => {
    const payload = { cmd: 'binaries_status' };
    expect(window.__TAURI_ISOLATION_HOOK__(payload)).toBe(payload);
  });

  it('continues rejecting unknown commands', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => window.__TAURI_ISOLATION_HOOK__({ cmd: 'untrusted_command' })).toThrow('Unauthorized command');
    warning.mockRestore();
  });
});
