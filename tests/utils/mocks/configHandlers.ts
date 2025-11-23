import { ensureInvokeArgsObject, IPCHandler } from '../tauriMock';
import { InvokeArgs } from '@tauri-apps/api/core';
import { defaultSettings } from '../../../src/tauri/types/config.ts';

export const configHandlers: Record<string, IPCHandler> = {
  config_get: () => {
    return defaultSettings;
  },
  config_set: (_cmd, args: InvokeArgs | undefined) => {
    const { patch } = ensureInvokeArgsObject<{ patch: Record<string, unknown> }>(args, 'config_set');
    return { defaultSettings, ...patch };
  },
};
