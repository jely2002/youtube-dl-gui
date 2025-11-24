<template>
  <div class="relative block w-full">
    <progress
        :id="composedId"
        class="progress w-full h-7 [&::-webkit-progress-value]:transition-all [&::-moz-progress-bar]:transition-all"
        :class="{ 'progress-error': error, 'progress-primary': !error }"
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

import { computed } from 'vue';

const composedId = computed(() => `${id}-progress`);

const { id, max, value } = defineProps({
  id: {
    type: String,
    required: true,
  },
  max: {
    type: Number,
    required: false,
  },
  value: {
    type: Number,
    required: false,
  },
  error: {
    type: Boolean,
    required: false,
    default: false,
  },
});

</script>
