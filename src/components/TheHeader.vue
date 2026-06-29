<template>
  <header class="relative z-20 p-4 bg-base-300 flex gap-4 justify-center w-full shadow-lg">
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
          flushLeft
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
              :class="{ 'font-semibold text-primary': watchClipboardStore.isActive }"
              type="button"
              :aria-pressed="watchClipboardStore.isActive"
              @click="watchClipboardStore.toggle()"
          >
            <clipboard-document-check-icon v-if="watchClipboardStore.isActive" class="w-4 h-4" />
            <clipboard-document-list-icon v-else class="w-4 h-4" />
            {{ t(watchClipboardStore.isActive ? 'layout.header.actions.watchClipboardStop' : 'layout.header.actions.watchClipboardStart') }}
          </button>
        </li>
        <li>
          <button class="gap-2 text-nowrap" type="button" @click="handleImportClick">
            <document-arrow-up-icon class="w-4 h-4" />
            {{ t('layout.header.actions.importFile') }}
          </button>
        </li>
        <li>
          <button
            class="gap-2 text-nowrap"
            :class="{ 'font-semibold text-primary': hasActiveInputFilters }"
            type="button"
            @click="openInputFilters"
          >
            <funnel-icon v-if="!hasActiveInputFilters" class="w-4 h-4" />
            <funnel-icon-solid v-else class="w-4 h-4" />
            {{ t('layout.header.actions.inputFilters') }}
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

import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  Cog8ToothIcon,
  DocumentArrowUpIcon,
  FunnelIcon,
} from '@heroicons/vue/24/outline';
import { FunnelIcon as FunnelIconSolid } from '@heroicons/vue/24/solid';
import { useMediaStore } from '../stores/media/media';
import { ref, computed, onMounted, watch } from 'vue';
import { useClipboard } from '../composables/useClipboard';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../stores/settings';
import { isValidUrl } from '../helpers/url.ts';
import BaseButtonDropdown from './base/BaseButtonDropdown.vue';
import { useWatchClipboardStore } from '../stores/watchClipboard.ts';
import { useToastStore } from '../stores/toast.ts';
import {
  getUrlImportReadErrorToast,
  getUrlImportToast,
  isSupportedImportFile,
  parseUrlFileText,
  parseUrlInputText,
} from '../helpers/urlImport.ts';
import { isInputFiltersActive } from '../helpers/inputFilters.ts';

const { t } = useI18n();
const router = useRouter();
const mediaStore = useMediaStore();
const toastStore = useToastStore();

const settingsStore = useSettingsStore();
const watchClipboardStore = useWatchClipboardStore();

const doPolling = computed(() => settingsStore.settings.input.autoFillClipboard || watchClipboardStore.isActive);
const hasActiveInputFilters = computed(() => isInputFiltersActive(settingsStore.settings.inputFilters));

const { content: clipboardContent, poll } = useClipboard({
  doPolling,
});

const input = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const fileImportImmediateDownload = ref(false);

const inputPlaceholder = computed(() => {
  if (watchClipboardStore.isActive) {
    return t('layout.header.watchClipboardPlaceholder');
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
  if (!watchClipboardStore.isActive || !isValidUrl(urlToRecord) || watchClipboardStore.hasSeen(urlToRecord)) {
    return;
  }

  watchClipboardStore.markSeen(urlToRecord);
  await mediaStore.dispatchMediaInfoFetch(urlToRecord);
}

function addFromInput(immediateDownload: boolean = false) {
  const urlToSubmit = url.value.length > 0 ? url.value : clipboardContent.value;
  if (!urlToSubmit) return;
  void processParsedUrls(parseUrlInputText(urlToSubmit), immediateDownload, true);
  void router.push('/');
  url.value = '';
}

async function processParsedUrls(
  result: { urls: string[]; skipped: number },
  immediateDownload: boolean = false,
  fromInput: boolean = false,
) {
  if (result.urls.length > 0) {
    if (immediateDownload) {
      await mediaStore.addUrlBatchAndDownload(result.urls, false, true);
    } else {
      await mediaStore.addUrlBatch(result.urls);
    }
  }

  if (!fromInput || result.urls.length > 1) {
    const toast = getUrlImportToast(result);
    toastStore.showToast(toast.message, { style: toast.style });
  }
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

function openInputFilters() {
  void router.push({ name: 'input-filters' });
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

watch(() => watchClipboardStore.isActive, (isActive) => {
  if (!isActive) return;
  poll();
  const currentClipboard = clipboardContent.value;
  if (!currentClipboard) return;
  void addClipboardUrlToQueue(currentClipboard);
});

</script>
