<template>
  <base-fieldset
      :legend="t('auth.cookies.legend')"
      :badge="t('auth.cookies.legendBadge')"
      :label="t('auth.cookies.legendLabel')"
  >
    <base-file-input
        class="max-w-4xl"
        v-model="authSettings.cookieFile"
        :label="t('auth.cookies.file.label')"
        :recent-values="recentValues"
        @clear-recents="clearRecents"
        show-recent
    />
    <span class="label mb-2 gap-1">
      <i18n-t keypath="auth.cookies.file.hint" scope="global">
        <template #link>
          <a href="" class="link">
            {{ t('auth.cookies.file.hintLink') }}
          </a>
        </template>
      </i18n-t>
    </span>
    <label class="font-semibold mt-4" for="cookieBrowser">
      {{ t('auth.cookies.browser.label') }}
    </label>
    <select
        id="cookieBrowser"
        v-model="authSettings.cookieBrowser"
        class="select w-1/2 max-w-4xl"
    >
      <option value="none">{{ t('auth.cookies.browser.placeholder') }}</option>
      <option
          v-for="browser in cookieBrowserOptions"
          :key="browser"
          :value="browser.toLowerCase()"
      >
        {{ browser }}
      </option>
    </select>
    <span class="label mb-2 gap-1">
      <i18n-t keypath="auth.cookies.browser.hint" scope="global">
        <template #link>
          <a href="" class="link">
            {{ t('auth.cookies.browser.hintLink') }}
          </a>
        </template>
      </i18n-t>
    </span>
  </base-fieldset>
</template>
<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import BaseFileInput from '../base/BaseFileInput.vue';
import { AuthSettings } from '../../tauri/types/config.ts';
import { computed, PropType, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePreferencesStore } from '../../stores/preferences';

const { t } = useI18n();
const cookieFileRecentsKey = 'cookieFile';
const preferencesStore = usePreferencesStore();

const authSettings = defineModel({
  type: Object as PropType<AuthSettings>,
  required: true,
});

const recentValues = computed(() => preferencesStore.getRecentPaths(cookieFileRecentsKey));

watch(
  () => authSettings.value.cookieFile,
  (newFile, oldFile) => {
    if (newFile && newFile !== oldFile) {
      void preferencesStore.addRecentPath(cookieFileRecentsKey, newFile);
    }
  },
);

const clearRecents = () => {
  void preferencesStore.clearRecentPaths(cookieFileRecentsKey);
};

const cookieBrowserOptions = [
  'Brave',
  'Chrome',
  'Chromium',
  'Edge',
  'Firefox',
  'Opera',
  'Safari',
  'Vivaldi',
  'Whale',
];
</script>
