<template>
  <media-dual-select-options
    :audio-options="audioOptions"
    :video-options="videoOptions"
    :default-value="defaultValue"
    :model-value="modelValue"
    :track-type="trackType"
    :locale-key="localeKey"
    :auto-select="autoSelect"
    :join="join"
    v-bind="$attrs"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { computed, PropType, toRefs } from 'vue';
import { MediaTrack, TrackOptions, TrackType } from '../../tauri/types/media.ts';
import { SelectOption } from '../../helpers/forms.ts';
import { languageOptionsLookup } from '../../helpers/subtitles/languages.ts';
import MediaDualSelectOptions from './MediaDualSelectOptions.vue';

const props = defineProps({
  audioTracks: {
    type: Array as PropType<MediaTrack[]>,
    default: () => [],
  },
  videoTracks: {
    type: Array as PropType<MediaTrack[]>,
    default: () => [],
  },
  defaultValue: {
    type: Object as PropType<TrackOptions | undefined>,
    default: undefined,
  },
  modelValue: {
    type: Object as PropType<TrackOptions | undefined>,
    default: undefined,
  },
  trackType: {
    type: String as PropType<TrackType>,
    default: TrackType.both,
  },
  localeKey: {
    type: String,
    default: 'media.steps.configure.tracks',
  },
  autoSelect: {
    type: Boolean,
    default: false,
  },
  join: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  'update:modelValue': [TrackOptions | undefined];
}>();

defineOptions({
  inheritAttrs: false,
});

const {
  audioTracks,
  videoTracks,
} = toRefs(props);

const audioOptions = computed<SelectOption[]>(() =>
  toSelectOptions(audioTracks.value),
);

const videoOptions = computed<SelectOption[]>(() =>
  toSelectOptions(videoTracks.value),
);

function toSelectOptions(list: MediaTrack[] | undefined): SelectOption[] {
  const dedupedByLabel = new Map<string, SelectOption>();
  for (const track of list ?? []) {
    if (!track?.id) continue;
    // Empty selection already means "auto", so hide explicit auto entries.
    if (track.id === 'auto') continue;
    const label = formatTrackLabel(track);
    const key = label.toLowerCase();
    if (!dedupedByLabel.has(key)) {
      dedupedByLabel.set(key, { value: track.id, label });
    }
  }
  return [...dedupedByLabel.values()];
}

function formatTrackLabel(track: MediaTrack): string {
  if (track.id === 'auto') return track.label || 'Auto';

  const parts: string[] = [];
  const languageName = resolveLanguageName(track.language);
  if (languageName) parts.push(languageName);
  if (track.audioChannels) parts.push(`${track.audioChannels}ch`);

  if (parts.length > 0) return parts.join(' - ');
  return track.label || track.id;
}

function resolveLanguageName(language: string | undefined): string | undefined {
  if (!language) return undefined;

  const normalized = language.trim().replace('_', '-');
  if (!normalized) return undefined;

  const exact = languageOptionsLookup.get(normalized)
    || languageOptionsLookup.get(normalized.toLowerCase());
  if (exact) return exact.englishName;

  const base = normalized.split('-')[0]?.toLowerCase();
  if (!base) return normalized;
  return languageOptionsLookup.get(base)?.englishName ?? normalized;
}
</script>
