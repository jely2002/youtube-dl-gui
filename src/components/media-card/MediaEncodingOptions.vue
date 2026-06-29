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
import { PropType } from 'vue';
import { EncodingOptions, TrackType } from '../../tauri/types/media.ts';
import { SelectOption } from '../../helpers/forms.ts';
import MediaDualSelectOptions from './MediaDualSelectOptions.vue';

defineProps({
  audioOptions: {
    type: Array as PropType<SelectOption[]>,
    default: () => [],
  },
  videoOptions: {
    type: Array as PropType<SelectOption[]>,
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
</script>
