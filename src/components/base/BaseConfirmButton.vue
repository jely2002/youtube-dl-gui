<template>
  <base-button
    v-bind="$attrs"
    :loading="loading"
    :disabled="disabled"
    @click="onClick"
  >
    <slot v-if="!confirming" />
    <span v-else>{{ confirmationLabel }}</span>
  </base-button>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from './BaseButton.vue';

defineOptions({
  inheritAttrs: false,
});

const props
  = defineProps({
    confirmText: {
      type: String,
      required: false,
    },
    confirmTimeout: {
      type: Number,
      required: false,
      default: 4000,
    },
    loading: {
      type: Boolean,
      required: false,
      default: false,
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
  });

const emit = defineEmits<{
  (e: 'confirm'): void;
}>();

const { t } = useI18n();

const confirmationLabel = computed(() => props.confirmText ?? t('common.confirm'));

const confirming = ref(false);
let timeout: ReturnType<typeof setTimeout> | undefined;

const clearTimeoutHandle = () => {
  if (timeout) {
    clearTimeout(timeout);
    timeout = undefined;
  }
};

const onClick = () => {
  if (props.disabled || props.loading) {
    return;
  }

  if (!confirming.value) {
    confirming.value = true;
    timeout = setTimeout(() => {
      confirming.value = false;
      timeout = undefined;
    }, props.confirmTimeout);
    return;
  }

  confirming.value = false;
  clearTimeoutHandle();
  emit('confirm');
};

onBeforeUnmount(() => {
  clearTimeoutHandle();
});
</script>
