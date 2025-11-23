<template>
  <header class="p-4 bg-base-300 flex gap-4 justify-center w-full shadow-lg">
    <form @submit.prevent="submitUrl" class="join w-full max-w-[622px] flex-grow">
      <input
          v-model="url"
          id="url-input"
          name="URL input for video or playlist"
          class="input join-item w-full"
          :placeholder="inputPlaceholder"
          type="text"
      />
      <button
          class="btn btn-primary join-item"
          type="submit"
          :disabled="isInputDisabled"
      >
        {{ t('common.add') }}
      </button>
    </form>
    <router-link class="btn btn-subtle" :title="t('layout.header.nav.settings')" to="/settings">
      <span class="sr-only">{{ t('layout.header.nav.settings') }}</span>
      <cog-icon class="w-7 h-7"/>
    </router-link>
  </header>
</template>

<script setup lang="ts">

import { CogIcon } from '@heroicons/vue/24/outline';
import { useMediaStore } from '../stores/media/media';
import { ref, computed } from 'vue';
import { useClipboard } from '../composables/useClipboard';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../stores/settings';

const { t } = useI18n();
const router = useRouter();
const mediaStore = useMediaStore();

const settingsStore = useSettingsStore();

const doPolling = computed(() => settingsStore.settings.input.autoFillClipboard);

const { content: clipboardContent } = useClipboard({
  doPolling,
});

const inputPlaceholder = computed(() => {
  const defaultPlaceholder = t('layout.header.placeholder');
  if (clipboardHasValidUrl.value) {
    return clipboardContent.value ?? defaultPlaceholder;
  } else {
    return defaultPlaceholder;
  }
});

const clipboardHasValidUrl = computed(() => {
  if (!clipboardContent.value) return false;
  try {
    const url = new URL(clipboardContent.value);
    if (!/^https?:$/.test(url.protocol)) return false;
    return url.hostname;
  } catch {
    return false;
  }
});

const isInputDisabled = computed(() => {
  return url.value.length === 0 && !clipboardHasValidUrl.value;
});

const url = ref('');

const submitUrl = () => {
  const urlToSubmit = url.value.length > 0 ? url.value : clipboardContent.value;
  if (!urlToSubmit) return;
  void mediaStore.dispatchMediaInfoFetch(urlToSubmit);
  void router.push('/');
};

</script>
