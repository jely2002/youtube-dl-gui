import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { defaultPreferences, Preferences } from '../tauri/types/preferences.ts';
import { TrackType } from '../tauri/types/media';

type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<Preferences>(defaultPreferences);
  const pathExamples = ref<Record<string, string>>({});
  const filenameExamples = ref<Record<string, string>>({});

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
    const currentForLabel = preferences.value.recents.recent[label] ?? [];
    if (currentForLabel.includes(path)) {
      currentForLabel.splice(currentForLabel.indexOf(path), 1);
    }
    currentForLabel.unshift(path);
    preferences.value.recents.recent[label] = currentForLabel.slice(0, 5);
    await patch({ recents: { recent: preferences.value.recents.recent } });
  }

  function getRecentPaths(label: string): string[] {
    return preferences.value.recents.recent[label] ?? [];
  }

  async function clearRecentPaths(label: string): Promise<void> {
    preferences.value.recents.recent[label] = [];
    await patch({ recents: { recent: preferences.value.recents.recent } });
  }

  function setPathExample(trackType: TrackType, example: string): void {
    pathExamples.value[trackType] = example;
  }

  function setFilenameExample(trackType: TrackType, example: string): void {
    filenameExamples.value[trackType] = example;
  }

  function getPathExample(trackType: TrackType): string {
    return (pathExamples.value[trackType] ?? '') + (filenameExamples.value[trackType] ?? '');
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
    pathExamples,
    filenameExamples,
    load,
    patch,
    reset,
    getRecentPaths,
    addRecentPath,
    clearRecentPaths,
    setPathExample,
    setFilenameExample,
    getPathExample,
  };
});
