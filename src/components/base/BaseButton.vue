<template>
  <div :class="{ tooltip, [tooltipLocationClass]: true }" :data-tip="tooltip">
    <router-link
        v-if="to"
        :to="to"
        class="btn btn-subtle"
        v-bind="$attrs"
        :disabled="disabled ? true : undefined"
        activeClass="border-primary"
    >
      <slot v-if="loading" name="loader">
        <span class="sr-only">{{ t('common.loading') }}</span>
        <span class="loading loading-spinner loading-sm"></span>
      </slot>
      <slot v-else />
    </router-link>
    <button v-else @click="emit('click')" v-bind="$attrs" class="btn btn-subtle" :disabled="disabled ? true : undefined">
      <slot v-if="loading" name="loader">
        <span class="sr-only">{{ t('common.loading') }}</span>
        <span class="loading loading-spinner loading-sm"></span>
      </slot>
      <slot v-else />
    </button>
  </div>
</template>
<script setup lang="ts">

import { RouteLocationRaw } from 'vue-router';
import { computed, PropType } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineOptions({
  inheritAttrs: false,
});

const { loading, tooltipLocation } = defineProps({
  loading: {
    type: Boolean,
    required: false,
  },
  tooltip: {
    type: String,
    required: false,
  },
  tooltipLocation: {
    type: String,
    required: false,
    default: 'top',
  },
  to: {
    type: Object as PropType<RouteLocationRaw>,
    required: false,
  },
  disabled: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const tooltipLocationClass = computed(() => {
  switch (tooltipLocation) {
    default:
    case 'top':
      return 'tooltip-top';
    case 'bottom':
      return 'tooltip-bottom';
    case 'left':
      return 'tooltip-left';
    case 'right':
      return 'tooltip-right';
  }
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();

</script>
