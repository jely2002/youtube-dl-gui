<template>
  <header class="p-4 bg-base-300 flex gap-4 justify-center w-full shadow-lg">
    <input
        ref="fileInput"
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        class="hidden"
        @change="handleFileSelection"
    />
    <form @submit.prevent="handleSubmit" class="join w-full max-w-155 grow" autocomplete="off">
      <input
          v-model="url"
          id="queue-url-input"
          name="URL input to queue a video or playlist"
          class="input join-item w-full"
          :placeholder="inputPlaceholder"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          ref="input"
      />
      <base-button-dropdown
          btnClass="btn-primary"
          placement="bottom"
          align="end"
          menuWidthClass="w-64"
          :main-disabled="isInputDisabled"
          :caretAriaLabel="t('layout.header.actions.more')"
          @mainClick="handleAddClick"
      >
        <template #main>
          {{ t('common.add') }}
        </template>

        <li>
          <button
              class="gap-2 text-nowrap"
              :class="{ 'font-semibold text-primary': recordModeStore.isActive }"
              type="button"
              :aria-pressed="recordModeStore.isActive"
              @click="recordModeStore.toggle()"
          >
            <check-circle-icon v-if="recordModeStore.isActive" class="w-4 h-4" />
            <span v-else class="w-4 h-4 rounded-full border border-current"></span>
            {{ t(recordModeStore.isActive ? 'layout.header.actions.recordStop' : 'layout.header.actions.recordStart') }}
          </button>
        </li>
        <li>
          <button class="gap-2 text-nowrap" type="button" @click="handleImportClick">
            {{ t('layout.header.actions.importFile') }}
          </button>
        </li>
      </base-button-dropdown>
    </form>
    <router-link class="btn btn-subtle" :title="t('layout.header.nav.settings')" :to="{ name: 'settings.downloads' }">
      <span class="sr-only">{{ t('layout.header.nav.settings') }}</span>
      <cog8-tooth-icon class="w-6 h-6"/>
    </router-link>
  </header>
</template>

<script setup lang="ts">

import { CheckCircleIcon, Cog8ToothIcon } from '@heroicons/vue/24/outline';
import { useMediaStore } from '../stores/media/media';
import { ref, computed, onMounted, watch } from 'vue';
import { useClipboard } from '../composables/useClipboard';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../stores/settings';
import { isValidUrl } from '../helpers/url.ts';
import BaseButtonDropdown from './base/BaseButtonDropdown.vue';
import { useRecordModeStore } from '../stores/recordMode.ts';
import { useToastStore } from '../stores/toast.ts';
import {
  getUrlImportReadErrorToast,
  getUrlImportToast,
  isSupportedImportFile,
  parseUrlFileText,
  parseUrlInputText,
} from '../helpers/urlImport.ts';

const { t } = useI18n();
const router = useRouter();
const mediaStore = useMediaStore();
const toastStore = useToastStore();

const settingsStore = useSettingsStore();
const recordModeStore = useRecordModeStore();

const doPolling = computed(() => settingsStore.settings.input.autoFillClipboard || recordModeStore.isActive);

const { content: clipboardContent, poll } = useClipboard({
  doPolling,
});

const input = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const fileImportImmediateDownload = ref(false);

const inputPlaceholder = computed(() => {
  if (recordModeStore.isActive) {
    return t('layout.header.recordModePlaceholder');
  }
  const defaultPlaceholder = t('layout.header.placeholder');
  if (clipboardHasValidUrl.value) {
    return clipboardContent.value ?? defaultPlaceholder;
  } else {
    return defaultPlaceholder;
  }
});

const clipboardHasValidUrl = computed(() => isValidUrl(clipboardContent));

const isInputDisabled = computed(() => {
  return url.value.length === 0 && !clipboardHasValidUrl.value;
});

const url = ref('');

async function addClipboardUrlToQueue(urlToRecord: string) {
  if (!recordModeStore.isActive || !isValidUrl(urlToRecord) || recordModeStore.hasSeen(urlToRecord)) {
    return;
  }

  recordModeStore.markSeen(urlToRecord);
  await mediaStore.dispatchMediaInfoFetch(urlToRecord);
}

function addFromInput(immediateDownload: boolean = false) {
  const urlToSubmit = url.value.length > 0 ? url.value : clipboardContent.value;
  if (!urlToSubmit) return;
  void processParsedUrls(parseUrlInputText(urlToSubmit), immediateDownload);
  void router.push('/');
  url.value = '';
}

async function processParsedUrls(
  result: { urls: string[]; skipped: number },
  immediateDownload: boolean = false,
) {
  if (result.urls.length > 0) {
    if (immediateDownload) {
      await mediaStore.addUrlBatchAndDownload(result.urls);
    } else {
      await mediaStore.addUrlBatch(result.urls);
    }
  }

  const toast = getUrlImportToast(result);
  toastStore.showToast(toast.message, { style: toast.style });
}

function handleSubmit() {
  addFromInput();
}

function handleAddClick(event: MouseEvent) {
  addFromInput(event.shiftKey);
}

function handleImportClick(event: MouseEvent) {
  fileImportImmediateDownload.value = event.shiftKey;
  fileInput.value?.click();
}

async function handleFileSelection(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';

  if (!file || !isSupportedImportFile(file)) {
    const toast = getUrlImportToast({ urls: [], skipped: 0 });
    toastStore.showToast(toast.message, { style: toast.style });
    return;
  }

  try {
    const text = await file.text();
    await processParsedUrls(parseUrlFileText(text), fileImportImmediateDownload.value);
  } catch {
    const toast = getUrlImportReadErrorToast();
    toastStore.showToast(toast.message, { style: toast.style });
  } finally {
    fileImportImmediateDownload.value = false;
  }
}

onMounted(() => {
  input.value?.focus();
});

watch(clipboardContent, (value) => {
  if (!value) return;
  void addClipboardUrlToQueue(value);
});

watch(() => recordModeStore.isActive, (isActive) => {
  if (!isActive) return;
  poll();
  const currentClipboard = clipboardContent.value;
  if (!currentClipboard) return;
  void addClipboardUrlToQueue(currentClipboard);
});

</script>
