<template>
  <form @submit.prevent="saveSettings">
    <base-sub-nav>
      <template v-slot:default>
        <base-confirm-button
          :confirm-text="t('settings.reset.confirm')"
          :disabled="isSaving || isResetting"
          :loading="isResetting"
          type="button"
          class="btn-soft btn-warning"
          @confirm="resetSettings"
        >
          {{ t('settings.reset.label') }}
        </base-confirm-button>
        <base-button :disabled="!hasChanges || isResetting" :loading="isSaving" type="submit" class="btn-primary">
          {{ t('common.save') }}
        </base-button>
      </template>
      <template v-slot:title>
        <h1 class="text-lg font-semibold self-center">{{ t('settings.title') }}</h1>
      </template>
    </base-sub-nav>
    <section class="flex flex-col py-4 px-8">
      <template v-for="(section, i) in sections" :key="i">
        <component :is="section" v-model="draft" />
        <div class="divider my-2" />
      </template>
      <base-fieldset :legend="t('about.title')" label="">
        <div class="flex flex-col gap-2">
          <div class="flex gap-2 mb-2 w-full">
            <a href="https://github.com/jely2002/youtube-dl-gui" class="link link-subtle" target="_blank" rel="noopener">
              {{ t('about.links.github') }}
            </a>
            <hr class="divider divider-horizontal mx-0 border-none">
            <a href="https://github.com/jely2002/youtube-dl-gui/wiki" class="link" target="_blank" rel="noopener">
              {{ t('about.links.wiki') }}
            </a>
            <hr class="divider divider-horizontal mx-0 border-none">
            <a href="https://github.com/jely2002/youtube-dl-gui/issues/new?template=bug_report.md" class="link" target="_blank" rel="noopener">
              {{ t('about.links.reportABug') }}
            </a>
          </div>
          <p>{{ t('about.credit') }}</p>
          <div class="flex gap-2 items-center">
            <p>{{ t('about.poweredBy') }}</p>
            <button type="button" @click="openLicenses()" class="btn btn-soft btn-xs">
              {{ t('about.viewLicenses') }}
            </button>
          </div>
          <p>{{ t('about.version', { version: appVersion }) }}</p>

        </div>
      </base-fieldset>
    </section>
  </form>
</template>
<script setup lang="ts">
import BaseSubNav from '../../components/base/BaseSubNav.vue';
import BaseButton from '../../components/base/BaseButton.vue';
import BaseConfirmButton from '../../components/base/BaseConfirmButton.vue';
import { useSettingsStore } from '../../stores/settings';
import { computed, ref, toRaw } from 'vue';
import { useToastStore } from '../../stores/toast';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../composables/useTheme.ts';
import SettingsPerformance from '../../components/settings/SettingsPerformance.vue';
import SettingsOutput from '../../components/settings/SettingsOutput.vue';
import SettingsAppearance from '../../components/settings/SettingsAppearance.vue';
import SettingsNetwork from '../../components/settings/SettingsNetwork.vue';
import SettingsSponsorBlock from '../../components/settings/SettingsSponsorBlock.vue';
import { Settings } from '../../tauri/types/config.ts';
import BaseFieldset from '../../components/base/BaseFieldset.vue';
import { useOpener } from '../../composables/useOpener.ts';
import SettingsUpdate from '../../components/settings/SettingsUpdate.vue';
import SettingsInput from '../../components/settings/SettingsInput.vue';

const settingsStore = useSettingsStore();
const toastStore = useToastStore();
const { openInternalPath } = useOpener();
const { setTheme } = useTheme();
const { t } = useI18n();

const draft = ref<Settings>(structuredClone<Settings>(toRaw(settingsStore.settings)));

const isSaving = ref(false);
const isResetting = ref(false);
const hasChanges = computed(() => {
  return JSON.stringify(draft.value) !== JSON.stringify(settingsStore.settings);
});

const saveSettings = async () => {
  isSaving.value = true;
  await settingsStore.patch(draft.value);
  if (draft.value.appearance.theme) {
    setTheme(draft.value.appearance.theme);
  }
  isSaving.value = false;
  toastStore.showToast(t('settings.toasts.saved'), { style: 'success' });
};

const resetSettings = async () => {
  isResetting.value = true;
  try {
    const newSettings = await settingsStore.reset();
    draft.value = structuredClone<Settings>(toRaw(newSettings));
    if (newSettings.appearance.theme) {
      setTheme(newSettings.appearance.theme);
    }
    toastStore.showToast(t('settings.toasts.reset'), { style: 'success' });
  } finally {
    isResetting.value = false;
  }
};

const sections = [
  SettingsPerformance,
  SettingsInput,
  SettingsOutput,
  SettingsAppearance,
  SettingsNetwork,
  SettingsUpdate,
  SettingsSponsorBlock,
];

const appVersion = __APP_VERSION__;

const openLicenses = async () => {
  await openInternalPath('licenses/3rdpartylicenses.txt');
};
</script>
