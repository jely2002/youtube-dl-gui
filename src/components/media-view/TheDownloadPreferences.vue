<template>
  <section v-if="group" class="flex flex-col gap-4 py-4 px-8">
    <base-fieldset
      :legend="t('media.preferences.tabs.quality')"
      :label="t('media.preferences.labels.quality')"
    >
      <div class="flex flex-col gap-4 lg:flex-row lg:flex-wrap">
        <article class="rounded-box bg-base-100 p-4 lg:min-w-0 lg:w-[calc(50%-0.5rem)] lg:shrink-0">
          <h3 class="font-semibold mb-1">{{ t('media.steps.configure.format.formatSelect.placeholder') }}</h3>
          <p class="label mb-3">{{ t('media.preferences.hints.format') }}</p>
          <media-download-options
            :formats="group.formats"
            :default-value="optionsStore.getGlobalOptions()"
            v-model="selectedOptions"
            class="preferences-select flex gap-3 flex-col sm:flex-row"
            approximate
          />
        </article>

        <article class="rounded-box bg-base-100 p-4 lg:min-w-0 lg:w-[calc(50%-0.5rem)] lg:shrink-0">
          <h3 class="font-semibold mb-1">{{ t('settings.appearance.expandedOptions.options.encodings') }}</h3>
          <p class="label mb-3">{{ t('media.preferences.hints.encodings') }}</p>
          <media-encoding-options
            v-model="selectedEncodings"
            :default-value="optionsStore.getGlobalEncodings()"
            :audio-codecs="group.audioCodecs"
            :video-codecs="videoCodecs"
            :track-type="selectedTrackType"
            class="preferences-select flex gap-3 flex-col sm:flex-row"
          />
        </article>

        <article class="rounded-box bg-base-100 p-4 lg:min-w-0 lg:w-[calc(50%-0.5rem)] lg:shrink-0">
          <h3 class="font-semibold mb-1">{{ t('settings.appearance.expandedOptions.options.tracks') }}</h3>
          <p class="label mb-3">{{ t('media.preferences.hints.tracks') }}</p>
          <media-track-options
            v-model="selectedTracks"
            :default-value="optionsStore.getGlobalTracks()"
            :audio-tracks="group.audioTracks ?? []"
            :video-tracks="group.videoTracks ?? []"
            :track-type="selectedTrackType"
            class="preferences-select flex gap-3 flex-col sm:flex-row"
          />
        </article>
      </div>
    </base-fieldset>
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
import BaseFieldset from '../base/BaseFieldset.vue';
import { useI18n } from 'vue-i18n';

const groupStore = useMediaGroupStore();
const optionsStore = useMediaOptionsStore();
const { t } = useI18n();

const { groupId } = defineProps({
  groupId: {
    type: String,
    required: true,
  },
});

const group = computed<Group | undefined>(() => groupStore.findGroupById(groupId));

const selectedOptions = computed({
  get: () => optionsStore.getOptions(group.value?.id ?? ''),
  set: (value: DownloadOptions) => optionsStore.setOptions(group.value?.id ?? '', value),
});

const selectedEncodings = computed({
  get: () => optionsStore.getEncodings(group.value?.id ?? ''),
  set: (value: EncodingOptions | undefined) => {
    if (value) optionsStore.setEncodings(group.value?.id ?? '', value);
    else optionsStore.removeEncodings(group.value?.id ?? '');
  },
});
const selectedTracks = computed({
  get: () => optionsStore.getTracks(group.value?.id ?? ''),
  set: (value: TrackOptions | undefined) => {
    if (value) optionsStore.setTracks(group.value?.id ?? '', value);
    else optionsStore.removeTracks(group.value?.id ?? '');
  },
});
const selectedTrackType = computed(() => selectedOptions.value?.trackType ?? TrackType.both);

const videoCodecs = computed(() => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const codec of group.value?.videoCodecs ?? []) {
    const normalized = codec?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(codec.trim());
  }
  return deduped.sort((a, b) => a.localeCompare(b));
});

watch(selectedOptions, () => {
  if (!group.value) return;
  const globalOptions = optionsStore.getGlobalOptions();
  if (!selectedOptions.value && globalOptions) {
    optionsStore.applyOptionsToGroup(
      group.value,
      globalOptions,
    );
  }
});

watch(selectedEncodings, () => {
  if (!group.value) return;
  const globalEncodings = optionsStore.getGlobalEncodings();
  if (!selectedEncodings.value && globalEncodings) {
    optionsStore.applyEncodingsToGroup(
      group.value,
      globalEncodings,
    );
  }
});

watch(selectedTracks, () => {
  if (!group.value) return;
  const globalTracks = optionsStore.getGlobalTracks();
  if (!selectedTracks.value && globalTracks) {
    optionsStore.applyTracksToGroup(
      group.value,
      globalTracks,
    );
  }
});
</script>

<style scoped>
.preferences-select :deep(.select) {
  width: 100%;
}
</style>
