<template>
  <base-fieldset
      :legend="t('settings.performance.legend')"
      :label="t('settings.performance.legendLabel')"
  >
    <label class="font-semibold" for="maxConcurrency">{{ t('settings.performance.maxConcurrency.label') }}</label>
    <div class="flex w-full h-full items-center gap-4">
      <input
          v-model.number="settings.performance.maxConcurrency"
          type="range"
          :min="1"
          :max="32"
          id="maxConcurrency"
          style="display: block;"
          class="range range-primary"
      />
      <p class="w-4">
        {{ t('common.parenthesis', { content: settings.performance.maxConcurrency }) }}
      </p>
    </div>
    <label class="font-semibold mt-4" for="splitPlaylistThreshold">
      {{ t('settings.performance.splitPlaylistThreshold.label') }}
    </label>
    <select
        id="splitPlaylistThreshold"
        v-model="settings.performance.splitPlaylistThreshold"
        class="select mb-2"
    >
      <option :value="1">{{ t('settings.performance.splitPlaylistThreshold.options.never') }}</option>
      <option v-for="interval in splitIntervals" :key="interval" :value="interval">
        {{ t('settings.performance.splitPlaylistThreshold.options.lessThan', { number: interval }) }}
      </option>
    </select>
    <label class="font-semibold mt-2" for="autoLoadSize">
      {{ t('settings.performance.autoLoadSize.label') }}
    </label>
    <input
        id="autoLoadSize"
        type="checkbox"
        v-model="settings.performance.autoLoadSize"
        class="toggle toggle-primary"
    />
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const splitIntervals = [50, 100, 150, 200];
</script>
