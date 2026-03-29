<template>
  <div
    class="card-body py-0 pr-0 grow w-full min-w-0 grid grid-cols-2"
    :class="showExpandedOptions ? 'auto-rows-min' : 'grid-rows-[1fr_1fr_1fr]'"
  >
    <h2 :title="group.title ?? group.url" class="card-title block leading-8 overflow-hidden text-nowrap text-ellipsis text-base row-auto col-span-2">{{ group.title ?? group.url }}</h2>
    <media-download-options
        :formats="group.formats"
        :default-value="optionsStore.getGlobalOptions()"
        v-model="selectedOptions"
        class="flex gap-4 w-full col-start-1 col-end-3"
        approximate
    />
    <media-encoding-options
        v-if="expandedOptionsType === 'encodings'"
        v-model="selectedEncodings"
        :default-value="optionsStore.getGlobalEncodings()"
        :audio-codecs="group.audioCodecs"
        :video-codecs="videoCodecs"
        :track-type="selectedTrackType"
        class="flex gap-4 w-full col-start-1 col-end-3"
    />
    <media-track-options
        v-if="expandedOptionsType === 'tracks'"
        v-model="selectedTracks"
        :default-value="optionsStore.getGlobalTracks()"
        :audio-tracks="group.audioTracks ?? []"
        :video-tracks="group.videoTracks ?? []"
        :track-type="selectedTrackType"
        class="flex gap-4 w-full col-start-1 col-end-3"
    />
    <p class="flex items-center">
      {{ t('media.steps.configure.metadata.duration', { duration: useDuration(group).value }) }}
    </p>
    <p v-if="!group.isCombined" class="gap-1 flex items-center">
      {{ t('media.steps.configure.metadata.size') }}
      <template v-if="size">
        <span v-if="size">{{ size }}</span>
        <div class="tooltip tooltip-bottom" :data-tip="t('media.steps.configure.metadata.sizeInfo')">
          <information-circle-icon class="h-5 w-5 hover:opacity-60 transition-opacity"/>
        </div>
      </template>
      <button
        v-else-if="!settingsStore.settings.performance.autoLoadSize && !isSizeLoading"
        class="btn btn-soft btn-xs"
        @click="loadSize"
      >
        {{ t('common.load') }}
      </button>
      <span v-else class="loading loading-spinner loading-xs"></span>
    </p>
    <p v-else class="flex items-center">
      {{ t('media.steps.configure.metadata.items', { amount: group.total, failedCount: failedItemDisplay }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref, watch } from 'vue';
import { DownloadOptions, EncodingOptions, TrackOptions, TrackType } from '../../../tauri/types/media';
import { useDuration } from '../../../composables/useDuration';
import { Size, useMediaSizeStore } from '../../../stores/media/size';
import { useSettingsStore } from '../../../stores/settings';
import { formatBytes } from '../../../helpers/units';
import { Group } from '../../../tauri/types/group';
import { useMediaOptionsStore } from '../../../stores/media/options';
import { useI18n } from 'vue-i18n';
import MediaDownloadOptions from '../MediaDownloadOptions.vue';
import MediaEncodingOptions from '../MediaEncodingOptions.vue';
import MediaTrackOptions from '../MediaTrackOptions.vue';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';

const i18n = useI18n();
const t = i18n.t;

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const sizeStore = useMediaSizeStore();
const settingsStore = useSettingsStore();
const isSizeLoading = ref(false);
const optionsStore = useMediaOptionsStore();
const expandedOptionsType = computed(() => settingsStore.settings.appearance.expandedOptions);
const showExpandedOptions = computed(() => expandedOptionsType.value === 'encodings' || expandedOptionsType.value === 'tracks');

const failedItemDisplay = computed(() => {
  return group?.errored > 0 ? t('media.steps.configure.metadata.failedCount', { amount: group?.errored }) : '';
});

const selectedOptions = computed({
  get: () => optionsStore.getOptions(group.id),
  set: (value: DownloadOptions) => optionsStore.setOptions(group.id, value),
});

const selectedEncodings = computed({
  get: () => optionsStore.getEncodings(group.id),
  set: (value: EncodingOptions | undefined) => {
    if (value) optionsStore.setEncodings(group.id, value);
    else optionsStore.removeEncodings(group.id);
  },
});
const selectedTracks = computed({
  get: () => optionsStore.getTracks(group.id),
  set: (value: TrackOptions | undefined) => {
    if (value) optionsStore.setTracks(group.id, value);
    else optionsStore.removeTracks(group.id);
  },
});
const selectedTrackType = computed(() => selectedOptions.value?.trackType ?? TrackType.both);

const videoCodecs = computed(() => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const codec of group.videoCodecs ?? []) {
    const normalized = codec?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(codec.trim());
  }
  return deduped.sort((a, b) => a.localeCompare(b));
});

const size = computed(() => {
  if (!selectedOptions.value) return;
  const mediaSize: Size | undefined = sizeStore.getSizeForGroup(group.id, selectedOptions.value);
  const size = mediaSize?.size;
  // Media size is available, but ytdlp returned none.
  if (size === null || size === 0) {
    return t('common.unknown');
  // No media size is available at all.
  } else if (size === undefined) {
    return null;
  // A media size is available and ytdlp returned one.
  } else {
    return formatBytes(size);
  }
});

watch(size, (val) => {
  if (val) {
    isSizeLoading.value = false;
  }
});

function loadSize() {
  if (!selectedOptions.value) return;
  isSizeLoading.value = true;
  void sizeStore.requestSize(
    group.url ?? '',
    group.id,
    group.items[Object.keys(group.items)[0]].id,
    selectedOptions.value,
  );
}

watch(selectedOptions, () => {
  const globalOptions = optionsStore.getGlobalOptions();
  if (!selectedOptions.value && globalOptions) {
    optionsStore.applyOptionsToGroup(
      group,
      globalOptions,
    );
  }
  if (
    !group?.isCombined
    && settingsStore.settings.performance.autoLoadSize
    && selectedOptions.value
    && !sizeStore.getSizeForGroup(group.id, selectedOptions.value)
  ) {
    loadSize();
  } else {
    isSizeLoading.value = false;
  }
});

watch(selectedEncodings, () => {
  const globalEncodings = optionsStore.getGlobalEncodings();
  if (!selectedEncodings.value && globalEncodings) {
    optionsStore.applyEncodingsToGroup(
      group,
      globalEncodings,
    );
  }
});

watch(selectedTracks, () => {
  const globalTracks = optionsStore.getGlobalTracks();
  if (!selectedTracks.value && globalTracks) {
    optionsStore.applyTracksToGroup(
      group,
      globalTracks,
    );
  }
});

</script>
