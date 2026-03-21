<template>
  <form class="py-4 px-8">
    <div class="flex flex-col gap-4 max-w-4xl">
      <base-fieldset
        :legend="t('settings.output.legend')"
        :badge="t('media.preferences.badges.override')"
        :label="t('media.preferences.labels.output')"
      >
        <base-tabbed-pane
          v-model="activeTab"
          :tabs="tabs"
          id-prefix="media-output"
        >
          <template #video>
            <base-select
              :label="t('settings.output.tabs.video.container.label')"
              :hint="t('settings.output.tabs.video.container.hint')"
              :options="VideoContainer"
              :locale-key="'settings.output.tabs.video.container.options'"
              v-model="videoContainer"
              class="mb-4"
            />

            <base-select
              :label="t('settings.output.policy.label')"
              :hint="t('settings.output.policy.hint')"
              :options="TranscodePolicy"
              :locale-key="'settings.output.policy.options'"
              v-model="videoPolicy"
              class="mb-4"
            />

            <label class="font-semibold mb-2" for="video-file-template">
              {{ t('location.filename.outputFormat.label') }}
            </label>
            <input
              id="video-file-template"
              type="text"
              class="input w-full"
              v-model="videoTemplate"
            />
          </template>

          <template #audio>
            <base-select
              :label="t('settings.output.tabs.audio.format.label')"
              :hint="t('settings.output.tabs.audio.format.hint')"
              :options="AudioFormat"
              :locale-key="'settings.output.tabs.audio.format.options'"
              v-model="audioFormat"
              class="mb-4"
            />

            <base-select
              :label="t('settings.output.policy.label')"
              :hint="t('settings.output.policy.hint')"
              :options="TranscodePolicy"
              :locale-key="'settings.output.policy.options'"
              v-model="audioPolicy"
              class="mb-4"
            />

            <label class="font-semibold mb-2" for="audio-file-template">
              {{ t('location.filename.outputFormat.label') }}
            </label>
            <input
              id="audio-file-template"
              type="text"
              class="input w-full"
              v-model="audioTemplate"
            />
          </template>
        </base-tabbed-pane>

        <label class="font-semibold mt-3" for="override-add-thumbnail">
          {{ t('settings.output.addThumbnail.label') }}
        </label>
        <input
          id="override-add-thumbnail"
          type="checkbox"
          v-model="addThumbnail"
          class="toggle toggle-primary"
        />
        <p class="label">{{ t('settings.output.addThumbnail.hint') }}</p>

        <label class="font-semibold mt-2" for="override-add-metadata">
          {{ t('settings.output.addMetadata.label') }}
        </label>
        <input
          id="override-add-metadata"
          type="checkbox"
          v-model="addMetadata"
          class="toggle toggle-primary"
        />
        <p class="label">{{ t('settings.output.addMetadata.hint') }}</p>

        <label class="font-semibold mt-2" for="override-restrict-filenames">
          {{ t('location.filename.formatPreset.restrictFilenames.label') }}
        </label>
        <input
          id="override-restrict-filenames"
          type="checkbox"
          v-model="restrictFilenames"
          class="toggle toggle-primary"
        />
        <p class="label">{{ t('location.filename.formatPreset.restrictFilenames.hint') }}</p>
      </base-fieldset>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseFieldset from '../base/BaseFieldset.vue';
import BaseSelect from '../base/BaseSelect.vue';
import BaseTabbedPane from '../base/BaseTabbedPane.vue';
import { useSettingsStore } from '../../stores/settings.ts';
import { useMediaOptionsStore } from '../../stores/media/options.ts';
import { AudioFormat, DownloadOverrides, TranscodePolicy, VideoContainer } from '../../tauri/types/media.ts';

interface TabDef {
  id: string;
  label: string;
}

const props = defineProps({
  groupId: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
const settingsStore = useSettingsStore();
const optionsStore = useMediaOptionsStore();

const activeTab = ref<'video' | 'audio'>('video');
const tabs = computed<TabDef[]>(() => ([
  { id: 'video', label: t('settings.output.tabs.video.label') },
  { id: 'audio', label: t('settings.output.tabs.audio.label') },
]));

const videoContainer = ref(VideoContainer.mp4);
const videoPolicy = ref(TranscodePolicy.remuxOnly);
const audioFormat = ref(AudioFormat.mp3);
const audioPolicy = ref(TranscodePolicy.allowReencode);
const videoTemplate = ref('');
const audioTemplate = ref('');
const addThumbnail = ref(true);
const addMetadata = ref(true);
const restrictFilenames = ref(false);

const syncFromStore = () => {
  const global = settingsStore.settings.output;
  const override = optionsStore.getOverrides(props.groupId)?.output;
  videoContainer.value = override?.video?.container ?? global.video.container;
  videoPolicy.value = override?.video?.policy ?? global.video.policy;
  audioFormat.value = override?.audio?.format ?? global.audio.format;
  audioPolicy.value = override?.audio?.policy ?? global.audio.policy;
  videoTemplate.value = override?.fileNameTemplate ?? global.fileNameTemplate;
  audioTemplate.value = override?.audioFileNameTemplate ?? global.audioFileNameTemplate;
  addThumbnail.value = override?.addThumbnail ?? global.addThumbnail;
  addMetadata.value = override?.addMetadata ?? global.addMetadata;
  restrictFilenames.value = override?.restrictFilenames ?? global.restrictFilenames;
};

watch(() => props.groupId, syncFromStore, { immediate: true });

watch(
  [
    videoContainer,
    videoPolicy,
    audioFormat,
    audioPolicy,
    videoTemplate,
    audioTemplate,
    addThumbnail,
    addMetadata,
    restrictFilenames,
  ],
  () => {
    const global = settingsStore.settings.output;
    const existing = optionsStore.getOverrides(props.groupId);
    const output: NonNullable<DownloadOverrides['output']> = {};

    if (videoContainer.value !== global.video.container || videoPolicy.value !== global.video.policy) {
      output.video = {};
      if (videoContainer.value !== global.video.container) output.video.container = videoContainer.value;
      if (videoPolicy.value !== global.video.policy) output.video.policy = videoPolicy.value;
    }

    if (audioFormat.value !== global.audio.format || audioPolicy.value !== global.audio.policy) {
      output.audio = {};
      if (audioFormat.value !== global.audio.format) output.audio.format = audioFormat.value;
      if (audioPolicy.value !== global.audio.policy) output.audio.policy = audioPolicy.value;
    }

    if (videoTemplate.value !== global.fileNameTemplate) output.fileNameTemplate = videoTemplate.value;
    if (audioTemplate.value !== global.audioFileNameTemplate) output.audioFileNameTemplate = audioTemplate.value;
    if (addThumbnail.value !== global.addThumbnail) output.addThumbnail = addThumbnail.value;
    if (addMetadata.value !== global.addMetadata) output.addMetadata = addMetadata.value;
    if (restrictFilenames.value !== global.restrictFilenames) {
      output.restrictFilenames = restrictFilenames.value;
    }

    const hasOutput = Object.keys(output).length > 0;
    const next: DownloadOverrides = { ...(existing ?? {}) };
    if (hasOutput) next.output = output;
    else delete next.output;

    const hasAny = Object.values(next).some(v => v !== undefined);
    if (hasAny) optionsStore.setOverrides(props.groupId, next);
    else optionsStore.removeOverrides(props.groupId);
  },
);
</script>
