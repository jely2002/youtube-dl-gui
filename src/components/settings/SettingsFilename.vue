<template>
  <base-fieldset
      :legend="t('settings.filename.legend')"
      :label="t('settings.filename.legendLabel')"
  >
    <tabbed-settings-pane
        v-model="activeTab"
        :tabs="tabs"
        id-prefix="filename"
    >
      <template #video>
        <format-preset-selector
            id-prefix="video"
            :presets="videoFormatPresets"
            v-model="videoTemplate"
            v-model:preset="selectedVideoFormatPreset"
            :preset-label="t('settings.filename.formatPreset.label')"
            :format-label="t('settings.filename.outputFormat.label')"
            :example-label="t('settings.filename.formatPreset.exampleLabel')"
        />
      </template>

      <template #audio>
        <format-preset-selector
            id-prefix="audio"
            :presets="audioFormatPresets"
            v-model="audioTemplate"
            v-model:preset="selectedAudioFormatPreset"
            :preset-label="t('settings.filename.formatPreset.label')"
            :format-label="t('settings.filename.outputFormat.label')"
            :example-label="t('settings.filename.formatPreset.exampleLabel')"
        />
      </template>
    </tabbed-settings-pane>
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import TabbedSettingsPane from './TabbedSettingsPane.vue';
import FormatPresetSelector from './FormatPresetSelector.vue';
import { FormatPreset, Settings } from '../../tauri/types/config';
import { useI18n } from 'vue-i18n';
import { computed, onMounted, ref } from 'vue';

interface TabDef {
  id: string;
  label: string;
}

interface PresetDef {
  label: string;
  value: FormatPreset;
  format: string;
  example?: string;
}

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const activeTab = ref<'video' | 'audio'>('video');

const tabs: TabDef[] = [
  { id: 'video', label: t('settings.output.tabs.video.label') },
  { id: 'audio', label: t('settings.output.tabs.audio.label') },
];

const videoFormatPresets: PresetDef[] = [
  {
    label: t('settings.filename.formatPreset.options.titleQuality'),
    example: t('settings.filename.formatPreset.examples.video.titleQuality'),
    value: FormatPreset.TitleQuality,
    format: '%(title).200s-(%(height)sp%(fps).0d).%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.titleOnly'),
    example: t('settings.filename.formatPreset.examples.video.titleOnly'),
    value: FormatPreset.TitleOnly,
    format: '%(title).200s.%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.titleQualityPlaylist'),
    example: t('settings.filename.formatPreset.examples.video.titleQualityPlaylist'),
    value: FormatPreset.TitleQualityPlaylist,
    format: '%(playlist_index)02d-%(title).200s-(%(height)sp%(fps).0d).%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.custom'),
    value: FormatPreset.Custom,
    format: '',
  },
];

const audioFormatPresets: PresetDef[] = [
  {
    label: t('settings.filename.formatPreset.options.titleQuality'),
    example: t('settings.filename.formatPreset.examples.audio.titleQuality'),
    value: FormatPreset.TitleQuality,
    format: '%(title).200s-(%(abr)dk).%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.titleOnly'),
    example: t('settings.filename.formatPreset.examples.audio.titleOnly'),
    value: FormatPreset.TitleOnly,
    format: '%(title).200s.%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.titleQualityPlaylist'),
    example: t('settings.filename.formatPreset.examples.audio.titleQualityPlaylist'),
    value: FormatPreset.TitleQualityPlaylist,
    format: '%(playlist_index)02d-%(title).200s-(%(abr)dk).%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.custom'),
    value: FormatPreset.Custom,
    format: '',
  },
];

const selectedVideoFormatPreset = ref<FormatPreset>(FormatPreset.Custom);
const selectedAudioFormatPreset = ref<FormatPreset>(FormatPreset.Custom);

const videoTemplate = computed<string>({
  get: () => settings.value.output.fileNameTemplate ?? '',
  set(val) {
    settings.value.output.fileNameTemplate = val;
  },
});

const audioTemplate = computed<string>({
  get: () => settings.value.output.audioFileNameTemplate ?? '',
  set(val) {
    settings.value.output.audioFileNameTemplate = val;
  },
});

onMounted(() => {
  const videoMatch = videoFormatPresets.find(
    p => p.value !== FormatPreset.Custom
      && settings.value.output.fileNameTemplate === p.format,
  );
  selectedVideoFormatPreset.value = videoMatch?.value ?? FormatPreset.Custom;

  const audioMatch = audioFormatPresets.find(
    p => p.value !== FormatPreset.Custom
      && settings.value.output.audioFileNameTemplate === p.format,
  );
  selectedAudioFormatPreset.value = audioMatch?.value ?? FormatPreset.Custom;
});
</script>
