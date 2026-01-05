<template>
  <base-fieldset
      :legend="t('settings.sponsorBlock.legend')"
      :label="t('settings.sponsorBlock.legendLabel')"
  >
    <base-multi-select
        v-model="settings.sponsorBlock.removeParts"
        :options="sponsorBlockOptions"
        class="mb-2"
        :label="t('settings.sponsorBlock.removeParts.label')"
        :placeholder="t('settings.sponsorBlock.removeParts.placeholder')"
    >
      <template #option="{ option, selected }">
        <div>
          <div class="font-medium flex flex-row gap-2">
            <span>{{ option.label }}</span>
            <CheckIcon
                v-if="selected"
                class="w-4 h-4"
                aria-hidden="true"
            />
          </div>
          <div class="text-sm opacity-60">{{ option.description }}</div>
        </div>
      </template>
    </base-multi-select>
    <base-multi-select
        v-model="settings.sponsorBlock.markParts"
        :options="sponsorBlockMarkOptions"
        :label="t('settings.sponsorBlock.markParts.label')"
        :placeholder="t('settings.sponsorBlock.markParts.placeholder')"
    >
      <template #option="{ option, selected }">
        <div>
          <div class="font-medium flex flex-row gap-2">
            <span>{{ option.label }}</span>
            <CheckIcon
                v-if="selected"
                class="w-4 h-4"
                aria-hidden="true"
            />
          </div>
          <div class="text-sm opacity-60">{{ option.description }}</div>
        </div>
      </template>
    </base-multi-select>
    <label class="font-semibold mt-2" for="sponsorblockApiUrl">
      {{ t('settings.sponsorBlock.apiUrl.label') }}
    </label>
    <input
        type="text"
        id="sponsorblockApiUrl"
        class="input w-full"
        v-model="settings.sponsorBlock.apiUrl"
        placeholder="https://sponsor.ajay.app"
    />
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { useI18n } from 'vue-i18n';
import BaseMultiSelect from '../base/BaseMultiSelect.vue';
import { CheckIcon } from '@heroicons/vue/24/solid';
import { computed } from 'vue';
import { Settings } from '../../tauri/types/config.ts';

const i18n = useI18n();
const t = i18n.t;
const settings = defineModel<Settings>({ required: true });
const sponsorBlockParts = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'music_offtopic', 'preview', 'filler', 'chapter', 'hook', 'poi_highlight'];
const sponsorBlockLocalization: Record<string, { label: string; description: string }> = i18n.tm('settings.sponsorBlock.parts');
const sponsorBlockMarkOptions = computed(() => sponsorBlockParts.map(part => ({
  ...sponsorBlockLocalization[part],
  value: part,
})));
const sponsorBlockOptions = computed(() => sponsorBlockMarkOptions.value.filter(option => !['chapter', 'poi_highlight'].includes(option.value)));
</script>
