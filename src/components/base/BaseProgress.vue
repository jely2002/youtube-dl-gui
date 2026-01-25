<template>
  <div class="relative block w-full">
    <progress
        :id="composedId"
        class="progress w-full h-7 [&::-webkit-progress-value]:transition-all [&::-moz-progress-bar]:transition-all"
        :class="[style]"
        :max="max"
        :value="value"
    />
    <label
        :for="composedId"
        class="absolute text-white flex justify-center items-center text-sm align-middle text-center h-7 w-full top-0"
    >
      <slot/>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import { ProgressStyle } from '../../tauri/types/progress.ts';

const composedId = computed(() => `${id}-progress`);

const { id, max, value, style } = defineProps({
  id: {
    type: String,
    required: true,
  },
  max: {
    type: Number,
  },
  value: {
    type: Number,
  },
  style: {
    type: String as PropType<ProgressStyle>,
    default: ProgressStyle.primary,
  },
});

</script>
