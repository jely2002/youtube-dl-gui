import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export interface StrongholdStatus {
  unlocked: boolean;
  initError?: string;
}

export type StrongholdInitPayload = Omit<StrongholdStatus, 'initialized'>;

const defaultStrongholdStatus: StrongholdStatus = {
  unlocked: false,
};

export const STRONGHOLD_KEYS = {
  username: 'auth.username',
  password: 'auth.password',
  videoPassword: 'video.password',
  bearer: 'auth.bearer',
  headers: 'auth.headers',
} as const;

export interface StrongholdFields {
  username: string | null;
  password: string | null;
  videoPassword: string | null;
  bearer: string | null;
  headers: string | null;
}

export const useStrongholdStore = defineStore('stronghold', () => {
  const status = ref<StrongholdStatus>(defaultStrongholdStatus);
  const availableKeys = ref<number[][]>([]);

  async function loadStatus(): Promise<StrongholdStatus> {
    const strongholdStatus: StrongholdInitPayload = await invoke('stronghold_status');
    if (strongholdStatus.unlocked && !strongholdStatus.initError) {
      status.value.unlocked = true;

      availableKeys.value = await invoke('stronghold_keys');
    } else if (!strongholdStatus.unlocked && !strongholdStatus.initError) {
      status.value.unlocked = false;
    } else {
      status.value.unlocked = false;
      status.value.initError = strongholdStatus.initError ?? 'Unknown error.';
      throw new Error(`Failed to retrieve stronghold status: ${strongholdStatus.initError}`);
    }
    return status.value;
  }

  async function initialize(): Promise<StrongholdStatus> {
    const initStatus: StrongholdInitPayload = await invoke('stronghold_init');
    if (initStatus.initError) {
      status.value.initError = initStatus.initError;
      status.value.unlocked = false;
      throw new Error(`Failed to initialize stronghold: ${initStatus.initError}`);
    }
    status.value.unlocked = initStatus.unlocked;

    availableKeys.value = await invoke('stronghold_keys');
    return status.value;
  }

  async function getValues(): Promise<StrongholdFields> {
    const keys = Object.values(STRONGHOLD_KEYS);
    const entries = await invoke<Record<string, number[] | null>>('stronghold_get', { keys });
    const decoder = new TextDecoder();

    const result = {} as StrongholdFields;
    for (const [field, path] of Object.entries(STRONGHOLD_KEYS)) {
      const raw = entries[path];
      if (raw == null) {
        result[field as keyof StrongholdFields] = null;
      } else {
        result[field as keyof StrongholdFields] = decoder.decode(new Uint8Array(raw));
      }
    }

    return result;
  }

  async function setValues(fields: StrongholdFields): Promise<void> {
    const encoder = new TextEncoder();
    const converted: Record<string, number[] | null> = {};

    for (const [field, path] of Object.entries(STRONGHOLD_KEYS)) {
      const value = fields[field as keyof StrongholdFields];
      converted[path] = value == null ? null : Array.from(encoder.encode(value));
    }

    await invoke('stronghold_set', { entries: converted });
    availableKeys.value = await invoke<number[][]>('stronghold_keys');
  }

  function hasAvailableKeys(): boolean {
    return availableKeys.value.length > 0;
  }

  return { status, availableKeys, hasAvailableKeys, loadStatus, initialize, getValues, setValues };
});
