<template>
  <section class="flex flex-col gap-6 py-4 px-8">
    <media-download-options
        :formats="group.formats"
        :default-value="optionsStore.getGlobalOptions()"
        v-model="selectedOptions"
        class="flex gap-4 w-full col-start-1 col-end-3"
        approximate
    />
    <media-encoding-options
        v-model="selectedEncodings"
        :default-value="optionsStore.getGlobalEncodings()"
        :audio-codecs="group.audioCodecs"
        :video-codecs="videoCodecs"
        :track-type="selectedTrackType"
        class="flex gap-4 w-full col-start-1 col-end-3"
    />
    <media-track-options
        v-model="selectedTracks"
        :default-value="optionsStore.getGlobalTracks()"
        :audio-tracks="group.audioTracks ?? []"
        :video-tracks="group.videoTracks ?? []"
        :track-type="selectedTrackType"
        class="flex gap-4 w-full col-start-1 col-end-3"
    />
  </section>
</template>

<script setup lang="ts">
import { useMediaGroupStore } from '../../stores/media/group.ts';
import { Group } from '../../tauri/types/group.ts';
import MediaDownloadOptions from '../media-card/MediaDownloadOptions.vue';
import MediaEncodingOptions from '../media-card/MediaEncodingOptions.vue';
import MediaTrackOptions from '../media-card/MediaTrackOptions.vue';
import { DownloadOptions, EncodingOptions, TrackOptions, TrackType } from '../../tauri/types/media.ts';
import { useMediaOptionsStore } from '../../stores/media/options.ts';
import { computed, watch } from 'vue';

const groupStore = useMediaGroupStore();
const optionsStore = useMediaOptionsStore();

const { groupId } = defineProps({
  groupId: {
    type: String,
    required: true,
  },
});

const group: Group = groupStore.findGroupById(groupId);

const selectedOptions = computed({
  get: () => optionsStore.getOptions(group?.id ?? ''),
  set: (value: DownloadOptions) => optionsStore.setOptions(group?.id ?? '', value),
});

const selectedEncodings = computed({
  get: () => optionsStore.getEncodings(group?.id ?? ''),
  set: (value: EncodingOptions | undefined) => {
    if (value) optionsStore.setEncodings(group?.id ?? '', value);
    else optionsStore.removeEncodings(group?.id ?? '');
  },
});
const selectedTracks = computed({
  get: () => optionsStore.getTracks(group?.id ?? ''),
  set: (value: TrackOptions | undefined) => {
    if (value) optionsStore.setTracks(group?.id ?? '', value);
    else optionsStore.removeTracks(group?.id ?? '');
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

watch(selectedOptions, () => {
  const globalOptions = optionsStore.getGlobalOptions();
  if (!selectedOptions.value && globalOptions) {
    optionsStore.applyOptionsToGroup(
      group,
      globalOptions,
    );
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
