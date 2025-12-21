import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { defaultPreferences, Preferences } from '../tauri/types/preferences.ts';

type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<Preferences>(defaultPreferences);

  async function load(): Promise<Preferences> {
    const prefs = await invoke<Preferences>('preferences_get');
    applyPreferences(prefs);
    return prefs;
  }

  async function patch(partial: DeepPartial<Preferences>): Promise<void> {
    const newPrefs = await invoke<Preferences>('preferences_set', { patch: partial });
    applyPreferences(newPrefs);
  }

  async function reset(): Promise<Preferences> {
    const prefs = await invoke<Preferences>('preferences_reset');
    applyPreferences(prefs);
    return prefs;
  }

  function applyPreferences(prefs: Preferences): void {
    Object.assign(preferences.value, prefs);
  }

  return {
    preferences,
    load,
    patch,
    reset,
  };
});
