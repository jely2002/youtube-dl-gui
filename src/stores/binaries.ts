import { defineStore } from 'pinia';
import {
  BinaryDownloadCompletePayload,
  BinaryDownloadProgressPayload,
  BinaryDownloadStartPayload,
  BinaryProgress,
  BinaryCheckPayload, BinaryDownloadErrorPayload, DependencyReport,
} from '../tauri/types/binaries';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useToastStore } from './toast';
import { i18n } from '../i18n';

export const useBinariesStore = defineStore('binaries', () => {
  const tools = ref<Record<string, BinaryProgress>>({});
  const dependencies = ref<DependencyReport[]>([]);

  async function check(): Promise<string[]> {
    const result = await invoke<BinaryCheckPayload>('binaries_check');
    dependencies.value = result.dependencies ?? [];
    if (result.warning) console.warn(result.warning);
    const invalid = result.dependencies?.filter(report => report.status === 'configuredInvalid' || (report.active === null && report.tool !== 'AtomicParsley' && !result.tools.includes(report.tool))) ?? [];
    if (invalid.length > 0) {
      useToastStore().showToast(i18n.global.t('settings.dependencies.startupFailure', { tools: invalid.map(report => report.tool).join(', ') }), { style: 'error', duration: 10000 });
    }
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
    const tool = tools.value[payload.tool] ??= { total: 0, percent: 0, received: 0 };
    tool.version = payload.version;
  }

  function processBinaryDownloadProgress(payload: BinaryDownloadProgressPayload) {
    const tool = tools.value[payload.tool] ??= { total: 0, percent: 0, received: 0 };
    tool.total = payload.total;
    tool.received = payload.received;
    tool.percent = Math.round(tool.received / tool.total * 100);
  }

  function processBinaryDownloadComplete(payload: BinaryDownloadCompletePayload) {
    const tool = tools.value[payload.tool] ??= { total: 0, percent: 0, received: 0 };
    tool.received = tool.total;
    tool.percent = 100;
  }

  function processBinaryDownloadError(payload: BinaryDownloadErrorPayload) {
    const tool = tools.value[payload.tool] ??= { total: 0, percent: 0, received: 0 };
    tool.error = `[${payload.stage}] ${payload.error}`;
  }

  return { tools, dependencies, check, ensure, processBinaryDownloadStart, processBinaryDownloadProgress, processBinaryDownloadError, processBinaryDownloadComplete };
});
