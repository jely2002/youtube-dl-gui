<template>
  <form class="px-8 py-4">
    <div class="flex max-w-4xl flex-col gap-4">
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
              v-model="outputState.video.container"
              :label="t('settings.output.tabs.video.container.label')"
              :hint="t('settings.output.tabs.video.container.hint')"
              :options="VideoContainer"
              :locale-key="'settings.output.tabs.video.container.options'"
              class="mb-4"
            />

            <base-select
              v-model="outputState.video.policy"
              :label="t('settings.output.policy.label')"
              :hint="t('settings.output.policy.hint')"
              :options="TranscodePolicy"
              :locale-key="'settings.output.policy.options'"
              class="mb-4"
            />

            <label class="mb-2 font-semibold" for="video-file-template">
              {{ t('location.filename.outputFormat.label') }}
            </label>
            <input
              id="video-file-template"
              v-model="outputState.fileNameTemplate"
              type="text"
              class="input w-full"
            />
          </template>

          <template #audio>
            <base-select
              v-model="outputState.audio.format"
              :label="t('settings.output.tabs.audio.format.label')"
              :hint="t('settings.output.tabs.audio.format.hint')"
              :options="AudioFormat"
              :locale-key="'settings.output.tabs.audio.format.options'"
              class="mb-4"
            />

            <base-select
              v-model="outputState.audio.policy"
              :label="t('settings.output.policy.label')"
              :hint="t('settings.output.policy.hint')"
              :options="TranscodePolicy"
              :locale-key="'settings.output.policy.options'"
              class="mb-4"
            />

            <label class="mb-2 font-semibold" for="audio-file-template">
              {{ t('location.filename.outputFormat.label') }}
            </label>
            <input
              id="audio-file-template"
              v-model="outputState.audioFileNameTemplate"
              type="text"
              class="input w-full"
            />
          </template>
        </base-tabbed-pane>

        <label class="mt-3 font-semibold" for="override-add-thumbnail">
          {{ t('settings.output.addThumbnail.label') }}
        </label>
        <input
          id="override-add-thumbnail"
          v-model="outputState.addThumbnail"
          type="checkbox"
          class="toggle toggle-primary"
        />
        <p class="label">{{ t('settings.output.addThumbnail.hint') }}</p>

        <label class="mt-2 font-semibold" for="override-add-metadata">
          {{ t('settings.output.addMetadata.label') }}
        </label>
        <input
          id="override-add-metadata"
          v-model="outputState.addMetadata"
          type="checkbox"
          class="toggle toggle-primary"
        />
        <p class="label">{{ t('settings.output.addMetadata.hint') }}</p>

        <label class="mt-2 font-semibold" for="override-restrict-filenames">
          {{ t('location.filename.formatPreset.restrictFilenames.label') }}
        </label>
        <input
          id="override-restrict-filenames"
          v-model="outputState.restrictFilenames"
          type="checkbox"
          class="toggle toggle-primary"
        />
        <p class="label mb-2">{{ t('location.filename.formatPreset.restrictFilenames.hint') }}</p>
        <div class="divider my-2" />
        <base-fieldset
          class="max-w-xl"
          :legend="t('settings.output.partialDownload.legend')"
          :label="t('settings.output.partialDownload.hint')"
        >
          <base-partial-download-selector
            v-if="currentSelection"
            v-model="currentSelection"
            :chapters="chapters"
            :duration-seconds="durationSeconds"
          />
        </base-fieldset>
      </base-fieldset>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { v4 as uuidv4 } from 'uuid';
import BasePartialDownloadSelector from '../base/BasePartialDownloadSelector.vue';
import BaseFieldset from '../base/BaseFieldset.vue';
import BaseSelect from '../base/BaseSelect.vue';
import BaseTabbedPane from '../base/BaseTabbedPane.vue';
import {
  buildPartialDownloadOverride,
  createDefaultSelection,
  createSelectionFromSection,
  type PartialDownloadSelection,
} from '../../helpers/partialDownload.ts';
import { useMediaGroupStore } from '../../stores/media/group.ts';
import { useMediaOptionsStore } from '../../stores/media/options.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { AudioFormat, DownloadOverrides, TranscodePolicy, VideoContainer } from '../../tauri/types/media.ts';
import { type OutputSettings } from '../../tauri/types/config.ts';

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
const groupStore = useMediaGroupStore();

const activeTab = ref<'video' | 'audio'>('video');
const tabs = computed<TabDef[]>(() => ([
  { id: 'video', label: t('settings.output.tabs.video.label') },
  { id: 'audio', label: t('settings.output.tabs.audio.label') },
]));
const outputState = reactive<OutputSettings>({
  ...settingsStore.settings.output,
  video: { ...settingsStore.settings.output.video },
  audio: { ...settingsStore.settings.output.audio },
});
const currentSelection = ref<PartialDownloadSelection>();

const durationSeconds = computed<number | undefined>(() => {
  const duration = groupStore.findGroupById(props.groupId)?.duration;
  return duration != null && duration > 0 ? duration : undefined;
});
const chapters = computed(() => groupStore.findGroupById(props.groupId)?.chapters ?? []);
const resolvedOutput = computed(() => {
  const globalOutput = settingsStore.settings.output;
  const override = optionsStore.getOverrides(props.groupId)?.output;

  return {
    ...globalOutput,
    ...override,
    video: { ...globalOutput.video, ...(override?.video ?? {}) },
    audio: { ...globalOutput.audio, ...(override?.audio ?? {}) },
    partialDownload: override?.partialDownload,
  };
});
const outputOverride = computed<DownloadOverrides['output'] | undefined>(() => {
  const global = settingsStore.settings.output;
  const output: NonNullable<DownloadOverrides['output']> = {};
  const changedVideo = pickChangedFields(outputState.video, global.video);
  const changedAudio = pickChangedFields(outputState.audio, global.audio);
  const changedScalars = pickChangedFields(
    {
      fileNameTemplate: outputState.fileNameTemplate,
      audioFileNameTemplate: outputState.audioFileNameTemplate,
      addThumbnail: outputState.addThumbnail,
      addMetadata: outputState.addMetadata,
      restrictFilenames: outputState.restrictFilenames,
    },
    {
      fileNameTemplate: global.fileNameTemplate,
      audioFileNameTemplate: global.audioFileNameTemplate,
      addThumbnail: global.addThumbnail,
      addMetadata: global.addMetadata,
      restrictFilenames: global.restrictFilenames,
    },
  );

  if (Object.keys(changedVideo).length > 0) output.video = changedVideo;
  if (Object.keys(changedAudio).length > 0) output.audio = changedAudio;
  Object.assign(output, changedScalars);

  const partialDownload = buildPartialDownloadOverride(currentSelection.value, durationSeconds.value);
  if (partialDownload) {
    output.partialDownload = partialDownload;
  }

  return Object.keys(output).length > 0 ? output : undefined;
});
function createDefaultSelectionState(): PartialDownloadSelection {
  return createDefaultSelection(uuidv4(), chapters.value, durationSeconds.value);
}

function pickChangedFields<T extends Record<string, unknown>>(current: T, base: T): Partial<T> {
  return (Object.keys(current) as Array<keyof T>).reduce((changed, key) => {
    if (current[key] !== base[key]) {
      changed[key] = current[key];
    }
    return changed;
  }, {} as Partial<T>);
}

function applyOutputState(output: OutputSettings) {
  Object.assign(outputState, output, {
    video: { ...output.video },
    audio: { ...output.audio },
  });
}

function syncFromStore() {
  applyOutputState(resolvedOutput.value);
  currentSelection.value = resolvedOutput.value.partialDownload?.section
    ? createSelectionFromSection(
        { ...resolvedOutput.value.partialDownload.section },
        uuidv4(),
        chapters.value,
        durationSeconds.value,
      )
    : createDefaultSelectionState();
}

watch(() => props.groupId, syncFromStore, { immediate: true });

watch(
  [durationSeconds, chapters],
  () => {
    if (!currentSelection.value) {
      currentSelection.value = createDefaultSelectionState();
    }
  },
  { immediate: true },
);

watch([() => props.groupId, outputOverride], () => {
  const existing = optionsStore.getOverrides(props.groupId);
  const next: DownloadOverrides = { ...(existing ?? {}) };

  if (outputOverride.value) next.output = outputOverride.value;
  else delete next.output;

  if (Object.values(next).some(value => value !== undefined)) {
    optionsStore.setOverrides(props.groupId, next);
  } else {
    optionsStore.removeOverrides(props.groupId);
  }
}, { deep: true });
</script>
