<template>
  <base-fieldset
      :legend="t('settings.input.legend')"
      :label="t('settings.input.legendLabel')"
  >
    <label class="font-semibold mt-2" for="autoFillClipboard">
      {{ t('settings.input.autoFillClipboard.label') }}
    </label>
    <input
        id="autoFillClipboard"
        type="checkbox"
        v-model="settings.input.autoFillClipboard"
        class="toggle toggle-primary"
    />
    <p class="label">{{ t('settings.input.autoFillClipboard.hint') }}</p>
    <label class="font-semibold mt-2" for="preferVideoInMixedLinks">
      {{ t('settings.input.preferVideoInMixedLinks.label') }}
    </label>
    <input
        id="preferVideoInMixedLinks"
        type="checkbox"
        v-model="settings.input.preferVideoInMixedLinks"
        class="toggle toggle-primary"
    />
    <p class="label">{{ t('settings.input.preferVideoInMixedLinks.hint') }}</p>
  </base-fieldset>
</template>
<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });
</script>
