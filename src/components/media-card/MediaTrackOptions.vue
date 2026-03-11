<template>
  <label :for="audioSelectId" class="sr-only">
    {{ locale.audioSelect.screenReader }}
  </label>
  <div :class="{ join }" v-bind="$attrs">
    <select
        v-model="selectedAudio"
        :id="audioSelectId"
        class="select select-primary"
        :class="{ 'join-item': join }"
        :disabled="isAudioDisabled || audioOptions.length === 0"
    >
      <option v-if="audioOptions.length === 0" value="">
        {{ locale.audioSelect.noFormats }}
      </option>
      <option v-else-if="!autoSelect" value="">
        {{ locale.audioSelect.placeholder }}
      </option>
      <option
          v-for="option in audioOptions"
          :key="option.value"
          :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>

    <label :for="videoSelectId" class="sr-only">
      {{ locale.videoSelect.screenReader }}
    </label>
    <select
        v-model="selectedVideo"
        :id="videoSelectId"
        class="select select-primary"
        :class="{ 'join-item': join }"
        :disabled="isVideoDisabled || videoOptions.length === 0"
    >
      <option v-if="videoOptions.length === 0" value="">
        {{ locale.videoSelect.noFormats }}
      </option>
      <option v-else-if="!autoSelect" value="">
        {{ locale.videoSelect.placeholder }}
      </option>
      <option
          v-for="option in videoOptions"
          :key="option.value"
          :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computed, ComputedRef, PropType, ref, toRefs, useId, watch } from 'vue';
import { MediaTrack, TrackOptions, TrackType } from '../../tauri/types/media.ts';
import { SelectOption } from '../../helpers/forms.ts';
import { languageOptionsLookup } from '../../helpers/subtitles/languages.ts';

const i18n = useI18n();

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
  defaultValue,
  modelValue,
  localeKey,
  trackType,
  autoSelect,
} = toRefs(props);

const locale: ComputedRef<{
  audioSelect: Record<string, string>;
  videoSelect: Record<string, string>;
}> = computed(() => i18n.tm(localeKey.value));

const baseId = useId();
const audioSelectId = `${baseId}-audio`;
const videoSelectId = `${baseId}-video`;

const selectedAudio = ref('');
const selectedVideo = ref('');
const hasDefaulted = ref(false);

const isAudioDisabled = computed(() => trackType.value === TrackType.video);
const isVideoDisabled = computed(() => trackType.value === TrackType.audio);

const audioOptions = computed<SelectOption[]>(() =>
  toSelectOptions(audioTracks.value),
);

const videoOptions = computed<SelectOption[]>(() =>
  toSelectOptions(videoTracks.value),
);

watch(() => modelValue?.value, (val) => {
  syncFromModel(val);
}, { immediate: true });

watch(
  [audioOptions, videoOptions, isAudioDisabled, isVideoDisabled],
  () => {
    if (!autoSelect.value) return;
    ensureValidSelections();
  },
  { immediate: true },
);

watch(
  [selectedAudio, selectedVideo, isAudioDisabled, isVideoDisabled],
  () => {
    const payload: TrackOptions = {};

    if (!isAudioDisabled.value && selectedAudio.value) {
      payload.audio = selectedAudio.value;
    }
    if (!isVideoDisabled.value && selectedVideo.value) {
      payload.video = selectedVideo.value;
    }

    emit('update:modelValue', Object.keys(payload).length ? payload : undefined);
  },
  { immediate: true, flush: 'post' },
);

function toSelectOptions(list: MediaTrack[] | undefined): SelectOption[] {
  const dedupedByLabel = new Map<string, SelectOption>();
  for (const track of list ?? []) {
    if (!track?.id) continue;
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

function ensureValidSelections() {
  if (!isAudioDisabled.value) {
    const audioValid = audioOptions.value.some(option => option.value === selectedAudio.value);
    if (!audioValid) selectedAudio.value = audioOptions.value[0]?.value ?? '';
  }
  if (!isVideoDisabled.value) {
    const videoValid = videoOptions.value.some(option => option.value === selectedVideo.value);
    if (!videoValid) selectedVideo.value = videoOptions.value[0]?.value ?? '';
  }
}

function syncFromModel(model: TrackOptions | undefined) {
  if (model) {
    hasDefaulted.value = true;
    selectedAudio.value = model.audio ?? '';
    selectedVideo.value = model.video ?? '';
    return;
  }

  if (hasDefaulted.value) return;
  hasDefaulted.value = true;

  const fromDefault = defaultValue?.value;
  if (fromDefault) {
    selectedAudio.value = fromDefault.audio ?? '';
    selectedVideo.value = fromDefault.video ?? '';
    return;
  }

  if (autoSelect.value) {
    ensureValidSelections();
  }
}
</script>
