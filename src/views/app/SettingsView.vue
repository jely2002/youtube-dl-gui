<template>
  <form @submit.prevent="saveSettings">
    <base-sub-nav>
      <template #default>
        <base-button-dropdown
            placement="bottom"
            align="end"
            btnClass="btn-primary"
            :mainDisabled="!hasChanges || isResetting"
            :mainLoading="isSaving"
            :caretAriaLabel="t('layout.footer.queue.more')"
            caretClass="px-2"
            mainType="submit"
        >
          <template #main>
            {{ t('common.save') }}
          </template>

          <li>
            <button type="button" class="gap-2 text-nowrap" @click="resetSettings">
              {{ t('settings.reset.label') }}
            </button>
          </li>
        </base-button-dropdown>
      </template>
      <template v-slot:title>
        <div role="tablist" class="tabs tabs-box flex gap-1">
          <router-link exactActiveClass="tab-active" role="tab" :to="{ name: 'settings.downloads' }" class="tab">
            {{ t('settings.tabs.downloads') }}
          </router-link>
          <router-link exactActiveClass="tab-active" role="tab" :to="{ name: 'settings.app' }" class="tab">
            {{ t('settings.tabs.app') }}
          </router-link>
          <router-link exactActiveClass="tab-active" role="tab" :to="{ name: 'settings.network' }" class="tab">
            {{ t('settings.tabs.network') }}
          </router-link>
          <router-link exactActiveClass="tab-active" role="tab" :to="{ name: 'settings.system' }" class="tab">
            {{ t('settings.tabs.system') }}
          </router-link>
          <router-link exactActiveClass="tab-active" role="tab" :to="{ name: 'settings.about' }" class="tab">
            {{ t('settings.tabs.about') }}
          </router-link>
        </div>
      </template>
    </base-sub-nav>
    <section class="flex flex-col py-4 px-8">
      <router-view v-slot="{ Component }">
        <component :is="Component" v-model="draft" />
      </router-view>
    </section>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseSubNav from '../../components/base/BaseSubNav.vue';
import { useSettingsStore } from '../../stores/settings';
import { useToastStore } from '../../stores/toast';
import { useTheme } from '../../composables/useTheme.ts';
import { Settings } from '../../tauri/types/config.ts';
import BaseButtonDropdown from '../../components/base/BaseButtonDropdown.vue';

const settingsStore = useSettingsStore();
const toastStore = useToastStore();
const { setTheme } = useTheme();
const { t } = useI18n();

const draft = ref<Settings>(structuredClone<Settings>(toRaw(settingsStore.settings)));

const isSaving = ref(false);
const isResetting = ref(false);
const hasChanges = computed(() => JSON.stringify(draft.value) !== JSON.stringify(settingsStore.settings));

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
</script>

<style scoped>
.tabs.tabs-box {
  background-color: var(--color-base-200);
  border-radius: var(--radius-box);
}

.tab {
  color: var(--color-base-content);
  border-radius: var(--radius-field);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tab:hover:not(.tab-active) {
  background-color: var(--color-neutral);
}

.tab-active {
  background-color: var(--color-neutral);
  border: var(--border) solid var(--color-primary);
}
</style>
