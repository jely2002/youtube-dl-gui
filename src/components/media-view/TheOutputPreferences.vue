<template>
  <form class="px-8 py-4">
    <div class="flex max-w-4xl flex-col gap-4">
      <base-fieldset
        :legend="t('settings.output.legend')"
        :badge="t('media.preferences.badges.override')"
        :label="t('media.preferences.labels.output')"
      >
        <output-settings-editor v-model="outputState" id-prefix="override" :show-precise-cuts="false">
          <template #video-extra>
            <label class="mb-2 mt-4 font-semibold" for="video-file-template">
              {{ t('location.filename.outputFormat.label') }}
            </label>
            <input
              id="video-file-template"
              v-model="outputState.fileNameTemplate"
              type="text"
              class="input w-full"
            />

            <div v-if="isPlaylistGroup" class="mt-4 flex flex-col gap-1">
              <label class="font-semibold" for="override-video-reverse-playlist-numbering">
                {{ t('location.filename.reversePlaylistNumbering.label') }}
              </label>
              <input
                id="override-video-reverse-playlist-numbering"
                v-model="outputState.reversePlaylistNumbering"
                type="checkbox"
                class="toggle toggle-primary my-1"
              />
              <p class="label">
                {{ t('location.filename.reversePlaylistNumbering.hint') }}
              </p>
            </div>
          </template>

          <template #audio-extra>
            <label class="mb-2 mt-4 font-semibold" for="audio-file-template">
              {{ t('location.filename.outputFormat.label') }}
            </label>
            <input
              id="audio-file-template"
              v-model="outputState.audioFileNameTemplate"
              type="text"
              class="input w-full"
            />

            <div v-if="isPlaylistGroup" class="mt-4 flex flex-col gap-1">
              <label class="font-semibold" for="override-audio-reverse-playlist-numbering">
                {{ t('location.filename.reversePlaylistNumbering.label') }}
              </label>
              <input
                id="override-audio-reverse-playlist-numbering"
                v-model="outputState.reversePlaylistNumbering"
                type="checkbox"
                class="toggle toggle-primary my-1"
              />
              <p class="label">
                {{ t('location.filename.reversePlaylistNumbering.hint') }}
              </p>
            </div>
          </template>

          <template #after-common>
            <div class="flex flex-col gap-1">
              <label class="font-semibold" for="override-restrict-filenames">
                {{ t('location.filename.formatPreset.restrictFilenames.label') }}
              </label>
              <input
                id="override-restrict-filenames"
                v-model="outputState.restrictFilenames"
                type="checkbox"
                class="toggle toggle-primary my-1"
              />
              <p class="label">
                {{ t('location.filename.formatPreset.restrictFilenames.hint') }}
              </p>
            </div>
            <div class="divider mt-4 mb-1" />
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
            <div class="flex max-w-xl flex-col gap-1">
              <label class="font-semibold" for="override-precise-cuts">
                {{ t('settings.output.preciseCuts.label') }}
              </label>
              <input
                id="override-precise-cuts"
                v-model="outputState.preciseCuts"
                type="checkbox"
                class="toggle toggle-primary my-1"
              />
              <p class="label whitespace-pre-line">
                {{ t('settings.output.preciseCuts.hint') }}
              </p>
            </div>
          </template>
        </output-settings-editor>
      </base-fieldset>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { v4 as uuidv4 } from 'uuid';
import BasePartialDownloadSelector from '../base/BasePartialDownloadSelector.vue';
import BaseFieldset from '../base/BaseFieldset.vue';
import OutputSettingsEditor from '../output/OutputSettingsEditor.vue';
import {
  buildPartialDownloadOverride,
  createDefaultSelection,
  createSelectionFromSection,
  type PartialDownloadSelection,
} from '../../helpers/partialDownload.ts';
import { useMediaGroupStore } from '../../stores/media/group.ts';
import { useMediaOptionsStore } from '../../stores/media/options.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { DownloadOverrides } from '../../tauri/types/media.ts';
import { type OutputSettings } from '../../tauri/types/config.ts';

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

const outputState = ref<OutputSettings>({
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
const isPlaylistGroup = computed(() => {
  const group = groupStore.findGroupById(props.groupId);
  return !!group?.playlistId || (group?.playlistCount ?? 0) > 1;
});
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
  const changedVideo = pickChangedFields(outputState.value.video, global.video);
  const changedAudio = pickChangedFields(outputState.value.audio, global.audio);
  const changedScalars = pickChangedFields(
    {
      fileNameTemplate: outputState.value.fileNameTemplate,
      audioFileNameTemplate: outputState.value.audioFileNameTemplate,
      addThumbnail: outputState.value.addThumbnail,
      saveThumbnail: outputState.value.saveThumbnail,
      addMetadata: outputState.value.addMetadata,
      preciseCuts: outputState.value.preciseCuts,
      reversePlaylistNumbering: outputState.value.reversePlaylistNumbering,
      restrictFilenames: outputState.value.restrictFilenames,
    },
    {
      fileNameTemplate: global.fileNameTemplate,
      audioFileNameTemplate: global.audioFileNameTemplate,
      addThumbnail: global.addThumbnail,
      saveThumbnail: global.saveThumbnail,
      addMetadata: global.addMetadata,
      preciseCuts: global.preciseCuts,
      reversePlaylistNumbering: global.reversePlaylistNumbering,
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

function createOutputState(output: OutputSettings): OutputSettings {
  return {
    ...output,
    video: { ...output.video },
    audio: { ...output.audio },
  };
}

function syncFromStore() {
  outputState.value = createOutputState(resolvedOutput.value);
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
