<template>
  <article class="card card-side w-full bg-base-300 shadow-lg">
    <div
        :key="tool.percent === 100 && !hasError ? 'done' : 'progress'"
        class="radial-progress transition-colors m-5 shrink-0"
        :class="{
          'text-success': tool.percent === 100 && !hasError,
          'text-error': hasError,
        }"
        role="progressbar"
        :style="`--value:${tool.percent};--size:5rem;--thickness:.5rem;`"
        :aria-valuenow="tool.percent"
    >
      <span v-if="tool.percent < 100">{{ t('common.percentage', { percent: tool.percent }) }}</span>
      <span v-else-if="hasError"><x-mark-icon class="w-8 h-8 color-error-700"/></span>
      <span v-else><check-icon class="w-8 h-8 color-primary-700"/></span>
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
