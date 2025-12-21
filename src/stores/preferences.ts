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

  async function addRecentPath(label: string, path: string): Promise<void> {
    const currentForLabel = preferences.value.paths.recent[label] ?? [];
    if (currentForLabel.includes(path)) {
      currentForLabel.splice(currentForLabel.indexOf(path), 1);
    }
    currentForLabel.unshift(path);
    preferences.value.paths.recent[label] = currentForLabel.slice(0, 5);
    await patch({ paths: { recent: preferences.value.paths.recent } });
  }

  function getRecentPaths(label: string): string[] {
    return preferences.value.paths.recent[label] ?? [];
  }

  async function clearRecentPaths(label: string): Promise<void> {
    preferences.value.paths.recent[label] = [];
    await patch({ paths: { recent: preferences.value.paths.recent } });
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
    getRecentPaths,
    addRecentPath,
    clearRecentPaths,
  };
});
