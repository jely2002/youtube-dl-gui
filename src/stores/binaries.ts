import { defineStore } from 'pinia';
import {
  BinaryDownloadCompletePayload,
  BinaryDownloadProgressPayload,
  BinaryDownloadStartPayload,
  BinaryProgress,
  BinaryCheckPayload, BinaryDownloadErrorPayload,
} from '../tauri/types/binaries';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from './settings';

export const useBinariesStore = defineStore('binaries', () => {
  const tools = ref<Record<string, BinaryProgress>>({});
  const settingsStore = useSettingsStore();

  async function check(): Promise<string[]> {
    if (!settingsStore.settings.update.updateBinaries) return [];
    const result = await invoke<BinaryCheckPayload>('binaries_check');
    tools.value = {};
    for (const tool of result.tools) {
      tools.value[tool] = { total: 0, percent: 0, received: 0 };
    }
    return result.tools;
  }

  async function ensure(toEnsure?: string[]) {
    await invoke<void>('binaries_ensure', { tools: toEnsure ?? Object.keys(tools.value) });
  }

  function processBinaryDownloadStart(payload: BinaryDownloadStartPayload) {
    const tool = tools.value[payload.tool];
    tool.version = payload.version;
  }

  function processBinaryDownloadProgress(payload: BinaryDownloadProgressPayload) {
    const tool = tools.value[payload.tool];
    tool.total = payload.total;
    tool.received = payload.received;
    tool.percent = Math.round(tool.received / tool.total * 100);
  }

  function processBinaryDownloadComplete(payload: BinaryDownloadCompletePayload) {
    const tool = tools.value[payload.tool];
    tool.received = tool.total;
    tool.percent = 100;
  }

  function processBinaryDownloadError(payload: BinaryDownloadErrorPayload) {
    const tool = tools.value[payload.tool];
    tool.error = `[${payload.stage}] ${payload.error}`;
  }

  return { tools, check, ensure, processBinaryDownloadStart, processBinaryDownloadProgress, processBinaryDownloadError, processBinaryDownloadComplete };
});
