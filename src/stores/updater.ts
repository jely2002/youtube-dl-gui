import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { UpdaterCheckPayload, UpdaterDownloadProgressPayload } from '../tauri/types/updater';
import { useSettingsStore } from './settings';

export const useUpdaterStore = defineStore('updater', () => {
  const checkResult = ref<UpdaterCheckPayload | undefined>();
  const downloadProgress = ref<UpdaterDownloadProgressPayload>({ received: 0, total: 0 });
  const isUpdating = ref(false);
  const isIgnored = ref(false);
  const isNeedingRestart = ref(false);
  const lastError = ref<string | undefined>();
  const settingsStore = useSettingsStore();

  async function check() {
    if (!settingsStore.settings.update.updateApp) return;
    checkResult.value = await invoke<UpdaterCheckPayload>('updater_check');
  }

  async function download() {
    try {
      isUpdating.value = true;
      await invoke('updater_download');
      isNeedingRestart.value = true;
    } catch (e) {
      console.error(e);
    } finally {
      isUpdating.value = false;
    }
  }

  async function install() {
    isNeedingRestart.value = false;
    try {
      await invoke('updater_install');
    } catch (e) {
      console.error(e);
    }
  }

  function ignore() {
    isIgnored.value = true;
  }

  function processUpdaterDownloadProgress(payload: UpdaterDownloadProgressPayload) {
    Object.assign(downloadProgress.value, payload);
  }

  function processUpdaterFinished() {
    isUpdating.value = false;
    isIgnored.value = true;
    downloadProgress.value = { received: 0, total: 0 };
  }

  function processUpdaterError(payload: string) {
    processUpdaterFinished();
    lastError.value = payload;
  }

  return { checkResult, downloadProgress, isUpdating, isIgnored, isNeedingRestart, lastError, ignore, check, download, install, processUpdaterDownloadProgress, processUpdaterFinished, processUpdaterError };
});
