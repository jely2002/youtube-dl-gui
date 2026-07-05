<template>
  <article class="card card-side w-full bg-base-300 shadow-lg">
    <div
        :key="tool.percent === 100 && !hasError ? 'done' : 'progress'"
        class="relative m-5 h-20 w-20 shrink-0"
        role="progressbar"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="clampedPercent"
    >
      <svg class="h-20 w-20 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
        <circle
            cx="20"
            cy="20"
            :r="radius"
            class="stroke-base-content/15 fill-none"
            :stroke-width="strokeWidth"
        />
        <circle
            cx="20"
            cy="20"
            :r="radius"
            fill="none"
            :stroke-width="strokeWidth"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
            class="transition-all duration-300"
            :class="progressRingClass"
        />
      </svg>
      <span class="absolute inset-0 flex items-center justify-center text-sm font-medium">
        <span v-if="tool.percent < 100">{{ t('common.percentage', { percent: tool.percent }) }}</span>
        <span v-else-if="hasError"><x-mark-icon class="w-8 h-8 color-error-700"/></span>
        <span v-else><check-icon class="w-8 h-8 color-primary-700"/></span>
      </span>
    </div>
    <div class="card-body">
      <section class="flex w-full items-center gap-2 mb-2">
        <h2 class="card-title">{{ name }}</h2>
        <span
            v-if="tool.version"
            :title="tool.version"
            class="badge badge-soft overflow-hidden text-ellipsis break-all"
            :class="{ 'badge-error': hasError, 'badge-primary': !hasError }"
        >
          {{ tool.version }}
        </span>
      </section>
      <p v-if="!hasError" class="mt-2">
        {{ t('common.divide', { left: formatBytes(tool.received), right: formatBytes(tool.total) }) }}
      </p>
      <details v-else class="collapse collapse-arrow bg-base-200 list-none">
        <summary class="collapse-title font-semibold py-2 px-4">
          {{ t('components.base.toolCard.failed') }}
        </summary>
        <pre class="p-4"><code class="text-wrap">{{ tool.error }}</code></pre>
      </details>
    </div>
  </article>
</template>
<script setup lang="ts">
import { formatBytes } from '../../helpers/units';
import { CheckIcon, XMarkIcon } from '@heroicons/vue/24/solid';
import { computed, PropType } from 'vue';
import { BinaryProgress } from '../../tauri/types/binaries';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { tool } = defineProps({
  name: {
    type: String,
    required: true,
  },
  tool: {
    type: Object as PropType<BinaryProgress>,
    required: true,
  },
});

const hasError = computed(() => !!tool.error);
const radius = 16;
const strokeWidth = 4;
const circumference = 2 * Math.PI * radius;
const clampedPercent = computed(() => Math.min(Math.max(tool.percent, 0), 100));
const dashOffset = computed(() => circumference * (1 - clampedPercent.value / 100));
const progressRingClass = computed(() => ({
  'stroke-success': tool.percent === 100 && !hasError.value,
  'stroke-error': hasError.value,
  'stroke-primary': tool.percent < 100 && !hasError.value,
}));
</script>

<style scoped>
details > summary::-webkit-details-marker,
details > summary::marker {
  display: none;
}

.collapse-arrow > summary:after {
  top: 1.125rem;
}
</style>
