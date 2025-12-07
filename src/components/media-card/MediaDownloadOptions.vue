<template>
  <label :for="trackSelectId" class="sr-only">
    {{ locale.trackSelect.screenReader }}
  </label>
  <select
      v-model="selectedTrackType"
      :id="trackSelectId"
      class="select select-primary"
  >
    <option
        v-for="trackType in trackOptions"
        :key="trackType.value"
        :value="trackType.value"
    >
      {{ trackType.label }}
    </option>
  </select>

  <label :for="formatSelectId" class="sr-only">
    {{ locale.formatSelect.screenReader }}
  </label>
  <select
      v-model="selectedFormatId"
      :id="formatSelectId"
      class="select select-primary"
      :disabled="formatOptions.length === 0"
      :key="selectedTrackType"
  >
    <option v-if="formatOptions.length === 0" value="">
      {{ locale.formatSelect.noFormats }}
    </option>
    <option v-else-if="!autoSelect" value="">
      {{ locale.formatSelect.placeholder }}
    </option>
  <option
      v-for="format in formatOptions"
      :key="format.value"
      :value="format.value"
  >
    {{ format.label }}
  </option>
  </select>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computed, PropType, ref, watch, toRefs, reactive, useId } from 'vue';
import { DownloadOptions, MediaFormat, TrackType } from '../../tauri/types/media.ts';
import { SelectOption } from '../../helpers/forms.ts';
import { approxAudio, approxVideo, sortFormats } from '../../helpers/formats.ts';

const i18n = useI18n();

const props = defineProps({
  formats: {
    type: Array as PropType<MediaFormat[]>,
    default: () => [],
  },
  defaultValue: {
    type: Object as PropType<DownloadOptions | undefined>,
    default: undefined,
  },
  modelValue: {
    type: Object as PropType<DownloadOptions | undefined>,
    default: undefined,
  },
  localeKey: {
    type: String,
    default: 'media.steps.configure.format',
  },
  autoSelect: {
    type: Boolean,
    default: true,
  },
  approximate: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  'update:modelValue': [DownloadOptions | undefined];
}>();

const {
  formats,
  defaultValue,
  localeKey,
  modelValue,
  autoSelect,
  approximate,
} = toRefs(props);

const selectedTrackType = ref<TrackType>(TrackType.both);
const selectedFormatId = ref('');
const hasDefaulted = ref(false);
const lastPick = reactive<{ audio?: string; video?: string }>({});

const locale = computed(() => i18n.tm(localeKey.value));
const isVideoLike = (t: TrackType) => t === TrackType.video || t === TrackType.both;

function makeKey(format: MediaFormat): string {
  return [
    `id=${format.id}`,
    `h=${format.height ?? ''}`,
    `fps=${format.fps ?? ''}`,
    `asr=${format.asr ?? ''}`,
  ].join('|');
}

const formatByKey = computed<Map<string, MediaFormat>>(() => {
  const map = new Map<string, MediaFormat>();
  for (const format of filteredFormats.value) {
    map.set(makeKey(format), format);
  }
  return map;
});

const baseId = useId();
const trackSelectId = `${baseId}-track`;
const formatSelectId = `${baseId}-format`;

const trackOptions = computed<SelectOption[]>(() => {
  const i18nLabels = i18n.tm('media.steps.configure.trackTypes');
  return Object.entries(TrackType).map(([label, value]) => ({
    value,
    label: i18nLabels[label] as string,
  }));
});

const formatsByTrackType = computed<Record<TrackType, MediaFormat[]>>(() => {
  const list = formats.value ?? [];
  return {
    [TrackType.audio]: sortFormats(list.filter(f => f.asr)),
    [TrackType.video]: sortFormats(list.filter(f => f.height)),
    [TrackType.both]: sortFormats(list.filter(f => f.height)),
  };
});

const filteredFormats = computed<MediaFormat[]>(() =>
  formatsByTrackType.value[selectedTrackType.value],
);

const formatOptions = computed<SelectOption[]>(() =>
  filteredFormats.value.map(format => ({
    value: makeKey(format),
    label: getFormatLabel(format, selectedTrackType.value),
  })),
);

const selectedFormat = computed<MediaFormat | undefined>(() =>
  formatByKey.value.get(selectedFormatId.value),
);

watch(() => modelValue?.value, (val) => {
  syncFromModel(val);
}, { immediate: true });

watch(selectedTrackType, (trackType, oldTrackType) => {
  if (!autoSelect.value) {
    selectedFormatId.value = '';
    return;
  }

  const switchedBetweenGroups = isVideoLike(trackType) !== isVideoLike(oldTrackType);
  if (!switchedBetweenGroups) return;

  const wantedId = isVideoLike(trackType) ? lastPick.video : lastPick.audio;
  const allowedIds = new Set(formatOptions.value.map(option => option.value));

  if (wantedId && allowedIds.has(wantedId)) {
    selectedFormatId.value = wantedId;
  } else {
    selectedFormatId.value = formatOptions.value[0]?.value ?? '';
  }
});

watch(
  [selectedTrackType, selectedFormat],
  () => {
    const format = selectedFormat.value;
    const payload: DownloadOptions = {
      trackType: selectedTrackType.value,
      ...(format ?? {}),
    };

    emit('update:modelValue', payload);

    if (format && isVideoLike(selectedTrackType.value)) {
      lastPick.video = format.id;
    } else if (format) {
      lastPick.audio = format.id;
    }
  },
  { immediate: true, flush: 'post' },
);

watch(
  formats,
  () => {
    if (!autoSelect.value) return;
    if (!selectedFormat.value && formatOptions.value.length) {
      selectedFormatId.value = formatOptions.value[0].value;
    }
  },
  { immediate: true },
);

function syncFromModel(model: DownloadOptions | undefined) {
  if (model) {
    hasDefaulted.value = true;
    selectedTrackType.value = model.trackType;

    const match = matchByDownloadOptions(model);

    if (autoSelect.value) {
      selectedFormatId.value = match ? makeKey(match) : (formatOptions.value[0]?.value ?? '');
      const picked = selectedFormatId.value;
      if (picked) {
        if (isVideoLike(model.trackType)) lastPick.video = picked;
        else lastPick.audio = picked;
      }
    }

    return;
  }

  if (!hasDefaulted.value) {
    hasDefaulted.value = true;

    const fromDefault = defaultValue?.value;
    if (fromDefault) {
      selectedTrackType.value = fromDefault.trackType;
      const match = matchByDownloadOptions(fromDefault);
      if (autoSelect.value) {
        selectedFormatId.value = match ? makeKey(match) : (formatOptions.value[0]?.value ?? '');
        const picked = selectedFormatId.value;
        if (picked) {
          if (isVideoLike(fromDefault.trackType)) lastPick.video = picked;
          else lastPick.audio = picked;
        }
      }
      return;
    }

    if (autoSelect.value && formatOptions.value.length) {
      selectedTrackType.value = TrackType.both;
      selectedFormatId.value = formatOptions.value[0].value;
    }
  }
}

function matchByDownloadOptions(options: DownloadOptions): MediaFormat | undefined {
  let match: MediaFormat | undefined;
  if (options.trackType === TrackType.audio) {
    match
      = (formats.value ?? []).find(f => f.asr === options.asr)
        || (approximate.value ? approxAudio(filteredFormats.value, options.asr) : undefined);
  } else {
    match
      = (formats.value ?? []).find(f => f.height === options.height && f.fps === options.fps)
        || (approximate.value ? approxVideo(filteredFormats.value, options.height, options.fps) : undefined);
  }
  return match;
}

function getFormatLabel(format: MediaFormat, trackType: TrackType): string {
  switch (trackType) {
    case TrackType.audio:
      return `${format.asr}kbps`;
    case TrackType.video:
    case TrackType.both:
    default:
      return format.fps
        ? `${format.height}p${format.fps}`
        : `${format.height}p`;
  }
}
</script>
