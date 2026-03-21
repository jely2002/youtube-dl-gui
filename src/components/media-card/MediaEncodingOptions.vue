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
import { EncodingOptions, TrackType } from '../../tauri/types/media.ts';
import { SelectOption } from '../../helpers/forms.ts';
import MediaDualSelectOptions from './MediaDualSelectOptions.vue';

const props = defineProps({
  audioCodecs: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  videoCodecs: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  defaultValue: {
    type: Object as PropType<EncodingOptions | undefined>,
    default: undefined,
  },
  modelValue: {
    type: Object as PropType<EncodingOptions | undefined>,
    default: undefined,
  },
  trackType: {
    type: String as PropType<TrackType>,
    default: TrackType.both,
  },
  localeKey: {
    type: String,
    default: 'media.steps.configure.encodings',
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
  'update:modelValue': [EncodingOptions | undefined];
}>();

defineOptions({
  inheritAttrs: false,
});

const {
  audioCodecs,
  videoCodecs,
} = toRefs(props);

const audioOptions = computed<SelectOption[]>(() =>
  toSelectOptions(audioCodecs.value),
);

const videoOptions = computed<SelectOption[]>(() =>
  toSelectOptions(videoCodecs.value),
);

function toSelectOptions(list: string[] | undefined): SelectOption[] {
  const deduped = [...new Set((list ?? []).filter(Boolean))];
  deduped.sort((a, b) => a.localeCompare(b));
  return deduped.map(value => ({
    value,
    label: value,
  }));
}
</script>
