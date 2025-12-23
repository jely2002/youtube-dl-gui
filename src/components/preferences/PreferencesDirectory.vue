<template>
  <base-fieldset
      :legend="t('location.directory.legend')"
      :label="t('location.directory.legendLabel')"
  >
    <base-tabbed-pane
        v-model="activeTab"
        :tabs="tabs"
        id-prefix="directory"
    >
      <template #video>
        <base-file-input
            class="max-w-4xl my-2"
            v-model="prefs.paths.videoDownloadDir"
            :label="t('location.directory.videoDir.label')"
            :recent-values="recentValues.videoDir"
            @clear-recents="clearRecents('videoDir')"
            show-recent
            directory
        />
        <p class="label mb-4">{{ t('location.directory.videoDir.hint') }}</p>
        <directory-preset-selector
            id-prefix="video"
            :presets="dirPresets"
            v-model="videoTemplate"
            v-model:preset="selectedVideoPreset"
            :track-type="TrackType.video"
            :preset-label="t('location.directory.directoryPreset.label')"
            :format-label="t('location.directory.outputFormat.label')"
            :example-label="t('location.directory.directoryPreset.exampleLabel')"
        />
      </template>

      <template #audio>
        <base-file-input
            class="max-w-4xl my-2"
            v-model="prefs.paths.audioDownloadDir"
            :label="t('location.directory.audioDir.label')"
            :recent-values="recentValues.audioDir"
            @clear-recents="clearRecents('audioDir')"
            show-recent
            directory
        />
        <p class="label mb-4">{{ t('location.directory.audioDir.hint') }}</p>
        <directory-preset-selector
            id-prefix="audio"
            :presets="dirPresets"
            v-model="audioTemplate"
            v-model:preset="selectedAudioPreset"
            :track-type="TrackType.audio"
            :preset-label="t('location.directory.directoryPreset.label')"
            :format-label="t('location.directory.outputFormat.label')"
            :example-label="t('location.directory.directoryPreset.exampleLabel')"
        />
      </template>
    </base-tabbed-pane>
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import BaseTabbedPane from '../base/BaseTabbedPane.vue';
import DirectoryPresetSelector from './DirectoryPresetSelector.vue';
import { DirectoryPreset } from '../../tauri/types/config';
import { useI18n } from 'vue-i18n';
import { computed, onMounted, ref, watch } from 'vue';
import { Preferences } from '../../tauri/types/preferences';
import BaseFileInput from '../base/BaseFileInput.vue';
import { TrackType } from '../../tauri/types/media';
import { usePreferencesStore } from '../../stores/preferences';

interface TabDef {
  id: string;
  label: string;
}

interface PresetDef {
  label: string;
  value: DirectoryPreset;
  format: string;
  example?: string;
}

const { t } = useI18n();
const preferencesStore = usePreferencesStore();
const prefs = defineModel<Preferences>({ required: true });
const emit = defineEmits(['clearRecents']);
const { recentValues } = defineProps<{ recentValues: Record<string, string[]> }>();

const activeTab = ref<'video' | 'audio'>('video');

const tabs: TabDef[] = [
  { id: 'video', label: t('settings.output.tabs.video.label') },
  { id: 'audio', label: t('settings.output.tabs.audio.label') },
];

const dirPresets: PresetDef[] = [
  {
    label: t('location.directory.directoryPreset.options.none'),
    example: '',
    value: DirectoryPreset.None,
    format: '',
  },
  {
    label: t('location.directory.directoryPreset.options.playlist'),
    example: t('location.directory.directoryPreset.examples.playlist'),
    value: DirectoryPreset.Playlist,
    format: '%(playlist_title)s',
  },
  {
    label: t('location.directory.directoryPreset.options.channel'),
    example: t('location.directory.directoryPreset.examples.channel'),
    value: DirectoryPreset.Channel,
    format: '%(uploader)s',
  },
  {
    label: t('location.directory.directoryPreset.options.channelPlaylist'),
    example: t('location.directory.directoryPreset.examples.channelPlaylist'),
    value: DirectoryPreset.ChannelPlaylist,
    format: '%(uploader)s/%(playlist_title)s',
  },
  {
    label: t('location.directory.directoryPreset.options.yearMonth'),
    example: t('location.directory.directoryPreset.examples.yearMonth'),
    value: DirectoryPreset.YearMonth,
    format: '%(upload_date>%Y)s/%(upload_date>%m)s',
  },
  {
    label: t('location.directory.directoryPreset.options.artistAlbum'),
    example: t('location.directory.directoryPreset.examples.artistAlbum'),
    value: DirectoryPreset.ArtistAlbum,
    format: '%(artist,uploader)s/%(album,playlist_title)s',
  },
  {
    label: t('location.directory.directoryPreset.options.custom'),
    value: DirectoryPreset.Custom,
    format: '',
  },

];

const selectedVideoPreset = ref<DirectoryPreset>(DirectoryPreset.Custom);
const selectedAudioPreset = ref<DirectoryPreset>(DirectoryPreset.Custom);

const videoTemplate = computed<string>({
  get: () => prefs.value.paths.videoDirectoryTemplate ?? '',
  set(val) {
    prefs.value.paths.videoDirectoryTemplate = val;
  },
});

const audioTemplate = computed<string>({
  get: () => prefs.value.paths.audioDirectoryTemplate ?? '',
  set(val) {
    prefs.value.paths.audioDirectoryTemplate = val;
  },
});

onMounted(() => {
  const videoMatch = dirPresets.find(
    p => p.value !== DirectoryPreset.Custom
      && prefs.value.paths.videoDirectoryTemplate === p.format,
  );
  selectedVideoPreset.value = videoMatch?.value ?? DirectoryPreset.Custom;

  const audioMatch = dirPresets.find(
    p => p.value !== DirectoryPreset.Custom
      && prefs.value.paths.audioDirectoryTemplate === p.format,
  );
  selectedAudioPreset.value = audioMatch?.value ?? DirectoryPreset.Custom;
});

const clearRecents = (label: string) => {
  emit('clearRecents', label);
};

watch(
  () => prefs.value.paths.audioDownloadDir,
  (newFile, oldFile) => {
    if (newFile && newFile !== oldFile) {
      void preferencesStore.addRecentPath('audioDir', newFile);
    }
  },
);

watch(
  () => prefs.value.paths.videoDownloadDir,
  (newFile, oldFile) => {
    if (newFile && newFile !== oldFile) {
      void preferencesStore.addRecentPath('videoDir', newFile);
    }
  },
);
</script>
