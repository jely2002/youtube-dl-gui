import { beforeEach, afterEach } from 'vitest';
import { clearMocks } from '@tauri-apps/api/mocks';
import { installTauriMock } from './tests/utils/tauriMock';
import { createPinia, setActivePinia } from 'pinia';
import { InvokeArgs } from '@tauri-apps/api/core';
import { mediaHandlers } from './tests/utils/mocks/mediaHandlers';
import { MockData } from './tests/e2e/utils/mockData';

beforeEach(() => {
  clearMocks();
  installTauriMock({ ...mediaHandlers });
  setActivePinia(createPinia());
});

afterEach(() => {
  clearMocks();
});

declare global {
  interface Window {
    __TAURI_INTERNALS__: {
      invoke: (cmd: string, args?: InvokeArgs) => Promise<unknown>;
      transformCallback: <T extends (...args: unknown[]) => unknown>(
        cb: T,
        once?: boolean,
      ) => T;
      unregisterCallback: (...args: unknown[]) => void;
      plugins: Record<string, unknown>;
    };
    __TAURI_EVENT_PLUGIN_INTERNALS__: {
      unregisterListener: (event: string, id: number) => void;
    };
    E2E: MockData;
  }
}
