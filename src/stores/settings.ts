import { defineStore } from 'pinia';
import { Ref, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getDefaultLocale, i18n } from '../i18n';
import { defaultSettings } from '../tauri/types/config.ts';
import { Settings } from '../tauri/types/config.ts';

type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(defaultSettings);

  async function load(): Promise<Settings> {
    const cfg = await invoke<Settings>('config_get');
    Object.assign(settings.value, cfg);
    return cfg;
  }

  async function patch(partial: DeepPartial<Settings>) {
    const newCfg = await invoke<Settings>('config_set', { patch: partial });
    Object.assign(settings.value, newCfg);
    if (newCfg.appearance.language) {
      const locale = i18n.global.locale as Ref<string>;
      locale.value = newCfg.appearance.language === 'system' ? getDefaultLocale() : newCfg.appearance.language;
      document.documentElement.setAttribute('lang', locale.value);
    }
  }

  function hasAuthConfigured() {
    return settings.value.auth.cookieFile !== null || settings.value.auth.cookieBrowser !== 'none';
  }

  return {
    settings,
    load,
    patch,
    hasAuthConfigured,
  };
});
