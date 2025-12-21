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
    <p class="font-semibold mt-2">
      {{ t('settings.input.authentication.label') }}
    </p>
    <router-link class="text-primary group font-semibold flex gap-1 items-center" :to="{ name: 'authentication' }">
      {{ t('settings.input.authentication.link') }}
      <arrow-right-icon class="w-5 h-5 group-focus:translate-x-1 group-hover:translate-x-1 transition-transform"/>
    </router-link>
    <section class="bg-base-100 flex justify-between w-full p-4 mt-2 rounded-box">
      <div class="flex flex-col gap-2">
        <label class="font-semibold" for="globalShortcuts">
          {{ t('settings.input.globalShortcuts.label') }}
        </label>
        <input
            id="globalShortcuts"
            type="checkbox"
            v-model="settings.input.globalShortcuts"
            class="toggle toggle-primary"
        />
      </div>
      <div class="flex flex-col justify-end" :class="{ 'opacity-70': settings.input.globalShortcuts === false }">
        <p class="label">
          {{ t('settings.input.globalShortcuts.add_hint') }}
          <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
          <kbd class="kbd">ctrl</kbd>+<kbd class="kbd">shift</kbd>+<kbd class="kbd">V</kbd>
        </p>
        <p class="label">
          {{ t('settings.input.globalShortcuts.download_hint') }}
          <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
          <kbd class="kbd">ctrl</kbd>+<kbd class="kbd">shift</kbd>+<kbd class="kbd">Enter</kbd>
        </p>
      </div>
    </section>
  </base-fieldset>
</template>
<script setup lang="ts">
import { ArrowRightIcon } from '@heroicons/vue/24/solid';
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });
</script>

<style scoped>
.kbd {
  border-radius: 4px;
  background-color: var(--color-base-300);
}
</style>
