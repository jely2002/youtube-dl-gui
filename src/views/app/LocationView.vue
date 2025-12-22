<template>
  <form @submit.prevent="">
    <base-sub-nav>
      <template v-slot:default>
        <base-button @click="save" :disabled="!hasChanges" :loading="isSaving" type="submit" class="btn-primary">
          {{ t('common.save') }}
        </base-button>
      </template>
      <template v-slot:title>
        <h1 class="text-lg font-semibold self-center">{{ t('location.title') }}</h1>
      </template>
    </base-sub-nav>
    <section class="flex flex-col mt-2 py-4 px-8">
      <base-file-input
          class="max-w-4xl my-2"
          v-model="settingsDraft.output.downloadDir"
          :label="t('location.downloadDir.label')"
          :recent-values="recentValues.downloadDir"
          @clear-recents="clearRecents('downloadDir')"
          :clearable="false"
          show-recent
          directory
      />
      <p class="label text-sm mb-4">{{ t('location.downloadDir.hint') }}</p>
      <div class="divider my-2"/>
      <preferences-directory
          v-model="preferencesDraft"
          :recent-values="recentValues"
          @clear-recents="clearRecents"
      />
      <div class="divider my-2"/>
      <preferences-filename v-model="settingsDraft"/>
    </section>
  </form>
</template>
<script setup lang="ts">
import BaseSubNav from '../../components/base/BaseSubNav.vue';
import BaseButton from '../../components/base/BaseButton.vue';
import { useSettingsStore } from '../../stores/settings';
import { computed, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Settings } from '../../tauri/types/config.ts';
import BaseFileInput from '../../components/base/BaseFileInput.vue';
import { usePreferencesStore } from '../../stores/preferences';
import { Preferences } from '../../tauri/types/preferences';
import PreferencesFilename from '../../components/preferences/PreferencesFilename.vue';
import PreferencesDirectory from '../../components/preferences/PreferencesDirectory.vue';
import { useToastStore } from '../../stores/toast';

const settingsStore = useSettingsStore();
const preferencesStore = usePreferencesStore();
const toastStore = useToastStore();
const { t } = useI18n();

const settingsDraft = ref<Settings>(structuredClone<Settings>(toRaw(settingsStore.settings)));
const preferencesDraft = ref<Preferences>(structuredClone<Preferences>(toRaw(preferencesStore.preferences)));

const isSaving = ref(false);

const hasSettingsChanges = computed(() => {
  return JSON.stringify(settingsDraft.value) !== JSON.stringify(settingsStore.settings);
});
const hasPathPreferencesChanges = computed(() => {
  return JSON.stringify(preferencesDraft.value.paths) !== JSON.stringify(preferencesStore.preferences.paths);
});
const hasChanges = computed(() => {
  return hasSettingsChanges.value || hasPathPreferencesChanges.value;
});

const recentValues = computed(() => ({
  downloadDir: preferencesStore.getRecentPaths('downloadDir'),
  videoDir: preferencesStore.getRecentPaths('videoDir'),
  audioDir: preferencesStore.getRecentPaths('audioDir'),
}));

watch(
  () => settingsDraft.value.output.downloadDir,
  (newFile, oldFile) => {
    if (newFile && newFile !== oldFile) {
      void preferencesStore.addRecentPath('downloadDir', newFile);
    }
  },
);

const clearRecents = (label: string) => {
  void preferencesStore.clearRecentPaths(label);
};

const save = async () => {
  isSaving.value = true;
  try {
    await settingsStore.patch(settingsDraft.value);
    await preferencesStore.patch({ paths: preferencesDraft.value.paths });
    toastStore.showToast(t('location.toasts.saved'), { style: 'success' });
  } catch (e) {
    console.error(e);
    toastStore.showToast(t('location.toasts.error'), { style: 'error' });
  } finally {
    isSaving.value = false;
  }
};
</script>
