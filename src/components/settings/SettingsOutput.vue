<template>
  <base-fieldset
      :legend="t('settings.output.legend')"
      :label="t('settings.output.legendLabel')"
  >
    <section class="bg-base-100 p-4 rounded-box mb-2">
      <div role="tablist" class="tabs tabs-box flex gap-2 mb-4">
        <button
            v-for="(tab, index) in tabs"
            type="button"
            :key="tab.id"
            :id="tab.id"
            :class="{ 'tab-active': activeTab === tab.id }"
            role="tab"
            :aria-selected="tab.id === activeTab"
            :aria-controls="tab.panel"
            @click="activeTab = tab.id"
            :tabindex="tab.id === activeTab ? 0 : -1"
            :ref="el => (tabRefs[index] = el as HTMLButtonElement)"
            @keydown="onTabKey($event, tab.id)"
            class="tab"
        >
          {{ tab.label }}
        </button>
      </div>
      <section
          v-show="activeTab === 'video'"
          role="tabpanel"
          id="video-output"
          aria-labelledby="video-output"
      >
        <h2 class="sr-only">{{ t('settings.output.tabs.video.screenreader') }}</h2>
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
      </section>
      <section
          v-show="activeTab === 'audio'"
          role="tabpanel"
          id="audio-output"
          aria-labelledby="audio-output"
          class="flex flex-col"
      >
        <h2 class="sr-only">{{ t('settings.output.tabs.audio.screenreader') }}</h2>
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
      </section>
    </section>
    <label class="font-semibold mt-2" for="addThumbnail">
      {{ t('settings.output.addThumbnail.label') }}
    </label>
    <input
        id="addThumbnail"
        type="checkbox"
        v-model="settings.output.addThumbnail"
        class="toggle toggle-primary"
    />
    <p class="label">{{ t('settings.output.addThumbnail.hint') }}</p>
    <label class="font-semibold mt-2" for="addMetadata">
      {{ t('settings.output.addMetadata.label') }}
    </label>
    <input
        id="addMetadata"
        type="checkbox"
        v-model="settings.output.addMetadata"
        class="toggle toggle-primary"
    />
    <p class="label">{{ t('settings.output.addMetadata.hint') }}</p>
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import { AudioFormat, TranscodePolicy, VideoContainer } from '../../tauri/types/media.ts';
import BaseSelect from '../base/BaseSelect.vue';

const i18n = useI18n();
const t = i18n.t;

const settings = defineModel<Settings>({ required: true });

const tabs = [
  { id: 'video', label: t('settings.output.tabs.video.label'), panel: 'video-output' },
  { id: 'audio', label: t('settings.output.tabs.audio.label'), panel: 'audio-output' },
];
const tabRefs = ref<HTMLButtonElement[]>([]);

const activeTab = ref('video');

function focusTab(index: number) {
  const el = tabRefs.value[index];
  if (el) el.focus();
}

function onTabKey(e: KeyboardEvent, id: string) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  if (e.key === 'ArrowRight') {
    const nextIdx = (idx + 1) % tabs.length;
    activeTab.value = tabs[nextIdx].id;
    focusTab(nextIdx);
    e.preventDefault();
  }

  if (e.key === 'ArrowLeft') {
    const prevIdx = (idx - 1 + tabs.length) % tabs.length;
    activeTab.value = tabs[prevIdx].id;
    focusTab(prevIdx);
    e.preventDefault();
  }
}
</script>

<style scoped>
.tabs.tabs-box {
  background-color: var(--color-base-100);
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
