<template>
  <base-fieldset
    :legend="t('settings.output.legend')"
    :label="t('settings.output.legendLabel')"
  >
    <output-settings-editor v-model="outputState">
      <template #after-common>
        <div class="mt-2 flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <p class="font-semibold">
              {{ t('settings.output.location.label') }}
            </p>
            <router-link
              class="text-primary group font-semibold flex gap-1 items-center"
              :to="{ name: 'location' }"
            >
              {{ t('settings.output.location.link') }}
              <arrow-right-icon
                class="w-5 h-5 group-focus:translate-x-1 group-hover:translate-x-1 transition-transform"
              />
            </router-link>
          </div>

          <div class="flex flex-col gap-1">
            <p class="font-semibold">
              {{ t('settings.output.subtitles.label') }}
            </p>
            <router-link
              class="text-primary group font-semibold flex gap-1 items-center"
              :to="{ name: 'subtitles' }"
            >
              {{ t('settings.output.subtitles.link') }}
              <arrow-right-icon
                class="w-5 h-5 group-focus:translate-x-1 group-hover:translate-x-1 transition-transform"
              />
            </router-link>
          </div>
        </div>
      </template>
    </output-settings-editor>
  </base-fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseFieldset from '../base/BaseFieldset.vue';
import OutputSettingsEditor from '../output/OutputSettingsEditor.vue';
import { Settings } from '../../tauri/types/config';
import { ArrowRightIcon } from '@heroicons/vue/24/solid';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const outputState = computed({
  get: () => settings.value.output,
  set: (value) => {
    settings.value.output = value;
  },
});
</script>
