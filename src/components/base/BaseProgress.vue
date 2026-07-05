<template>
  <div class="relative block w-full">
    <progress
        :id="composedId"
        class="progress w-full h-7 [&::-webkit-progress-value]:transition-all [&::-moz-progress-bar]:transition-all"
        :class="progressClass"
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

type ProgressVariant = 'primary' | 'warning' | 'error';

const PROGRESS_VARIANT_CLASS: Record<ProgressVariant, string> = {
  primary: 'progress-primary',
  warning: 'progress-warning',
  error: 'progress-error',
};

const composedId = computed(() => `${id}-progress`);

const { id, max, value, variant } = defineProps({
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
  variant: {
    type: String as PropType<ProgressVariant>,
    default: 'primary',
  },
});

const progressClass = computed(() => PROGRESS_VARIANT_CLASS[variant]);

</script>
