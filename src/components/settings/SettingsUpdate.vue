<template>
  <base-fieldset
      :legend="t('settings.update.legend')"
      :label="t('settings.update.legendLabel')"
  >
    <label class="font-semibold mt-2" for="updateBinaries">
      {{ t('settings.update.updateBinaries.label') }}
    </label>
    <input
        id="updateBinaries"
        type="checkbox"
        v-model="settings.update.updateBinaries"
        class="toggle toggle-primary"
    />
    <p class="label">{{ t('settings.update.updateBinaries.hint') }}</p>
    <label class="font-semibold mt-2" for="updateApp">
      {{ t('settings.update.updateApp.label') }}
    </label>
    <input
        id="updateApp"
        type="checkbox"
        v-model="settings.update.updateApp"
        class="toggle toggle-primary"
    />
    <p class="label">{{ t('settings.update.updateApp.hint') }}</p>
  </base-fieldset>
</template>
<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });
</script>
