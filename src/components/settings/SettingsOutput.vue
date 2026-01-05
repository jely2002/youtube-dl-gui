<template>
  <base-fieldset
      :legend="t('settings.output.legend')"
      :label="t('settings.output.legendLabel')"
  >
    <base-tabbed-pane
        v-model="activeTab"
        :tabs="tabs"
        id-prefix="output"
    >
      <template #video>
        <h2 class="sr-only">
          {{ t('settings.output.tabs.video.screenreader') }}
        </h2>

        <base-select
            :label="t('settings.output.tabs.video.container.label')"
            :hint="t('settings.output.tabs.video.container.hint')"
            :options="VideoContainer"
            :locale-key="'settings.output.tabs.video.container.options'"
            v-model="settings.output.video.container"
            class="mb-4"
        />

        <base-select
            :label="t('settings.output.policy.label')"
            :hint="t('settings.output.policy.hint')"
            :options="TranscodePolicy"
            :locale-key="'settings.output.policy.options'"
            v-model="settings.output.video.policy"
            class="mb-2"
        />
      </template>

      <template #audio>
        <h2 class="sr-only">
          {{ t('settings.output.tabs.audio.screenreader') }}
        </h2>

        <base-select
            :label="t('settings.output.tabs.audio.format.label')"
            :hint="t('settings.output.tabs.audio.format.hint')"
            :options="AudioFormat"
            :locale-key="'settings.output.tabs.audio.format.options'"
            v-model="settings.output.audio.format"
            class="mb-4"
        />

        <base-select
            :label="t('settings.output.policy.label')"
            :hint="t('settings.output.policy.hint')"
            :options="TranscodePolicy"
            :locale-key="'settings.output.policy.options'"
            v-model="settings.output.audio.policy"
            class="mb-2"
        />
      </template>
    </base-tabbed-pane>

    <label class="font-semibold mt-2" for="addThumbnail">
      {{ t('settings.output.addThumbnail.label') }}
    </label>
    <input
        id="addThumbnail"
        type="checkbox"
        v-model="settings.output.addThumbnail"
        class="toggle toggle-primary"
    />
    <p class="label">
      {{ t('settings.output.addThumbnail.hint') }}
    </p>

    <label class="font-semibold mt-2" for="addMetadata">
      {{ t('settings.output.addMetadata.label') }}
    </label>
    <input
        id="addMetadata"
        type="checkbox"
        v-model="settings.output.addMetadata"
        class="toggle toggle-primary"
    />
    <p class="label">
      {{ t('settings.output.addMetadata.hint') }}
    </p>

    <p class="font-semibold mt-2">
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
    <p class="font-semibold mt-2">
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
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import BaseSelect from '../base/BaseSelect.vue';
import BaseTabbedPane from '../base/BaseTabbedPane.vue';

import { Settings } from '../../tauri/types/config';
import { AudioFormat, TranscodePolicy, VideoContainer } from '../../tauri/types/media';
import { ArrowRightIcon } from '@heroicons/vue/24/solid';
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';

interface TabDef {
  id: string;
  label: string;
}

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const activeTab = ref<'video' | 'audio'>('video');

const tabs: TabDef[] = [
  { id: 'video', label: t('settings.output.tabs.video.label') },
  { id: 'audio', label: t('settings.output.tabs.audio.label') },
];
</script>
