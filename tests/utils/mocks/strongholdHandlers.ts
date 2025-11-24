import { ensureInvokeArgsObject, IPCHandler } from '../tauriMock';
import { StrongholdFields, StrongholdInitPayload } from '../../../src/stores/stronghold';
import { InvokeArgs } from '@tauri-apps/api/core';

export type StrongholdMockData = {
  fields?: Record<string, string | null>;
  status?: StrongholdInitPayload;
};

export const strongholdHandlers: Record<string, IPCHandler> = {
  stronghold_status: (): StrongholdInitPayload => {
    return window.E2E.stronghold?.status ?? {
      unlocked: false,
    };
  },
  stronghold_init: (): StrongholdInitPayload => {
    return window.E2E.stronghold?.status ?? {
      unlocked: true,
    };
  },
  stronghold_keys: (): number[][] => {
    const fields: StrongholdFields = window.E2E.stronghold?.fields ?? {};
    const encoder = new TextEncoder();

    const keys = Object.keys(fields);

    return keys.map(key => Array.from(encoder.encode(key)));
  },
  stronghold_get: (): Record<string, number[] | null> => {
    const fields: StrongholdFields = window.E2E.stronghold?.fields ?? {};
    const encoder = new TextEncoder();

    const result: Record<string, number[] | null> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value == null) {
        result[key] = null;
      } else {
        result[key] = Array.from(encoder.encode(value));
      }
    }
    return result;
  },
  stronghold_set: (_cmd, args: InvokeArgs | undefined): void => {
    ensureInvokeArgsObject<Record<string, number[] | null>>(args, 'stronghold_set');
  },
};
