<template>
  <p class="font-semibold">{{ label }}</p>
  <div class="join group w-full" v-bind="$attrs">
    <div class="w-full">
      <label class="input validator join-item w-full">
        <input ref="fileInput" @click="select" type="text" class="cursor-pointer w-full" readonly :value="inputText" required />
      </label>
      <div class="validator-hint hidden">{{ validatorMessage }}</div>
    </div>
    <button @click="select" type="button" class="btn btn-soft join-item group-hover:bg-base-200 group-hover:border-base-300">
      <template v-if="isSelecting">
        <span class="sr-only">{{ t('common.loading') }}</span>
        <span class="loading loading-spinner loading-sm"></span>
      </template>
      <template v-else>
        {{ t('components.base.fileInput.select') }}
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">

import { computed, onMounted, PropType, ref, watchEffect } from 'vue';
import { useDialog } from '../../composables/useDialog';
import { useI18n } from 'vue-i18n';

const { openPathDialog } = useDialog();
const { t } = useI18n();

const emit = defineEmits(['update:modelValue']);
defineOptions({
  inheritAttrs: false,
});

const isSelecting = ref(false);
const path = defineModel({ type: String as PropType<string | null>, required: false, default: null });
const fileInput = ref<HTMLInputElement | null>(null);

const { invalid, validatorMessage, label } = defineProps({
  label: {
    type: String,
    required: true,
  },
  invalid: {
    type: Boolean,
    required: false,
    default: false,
  },
  validatorMessage: {
    type: String,
    required: false,
  },
});

const inputText = computed(() => {
  return path.value ?? t('components.base.fileInput.placeholder');
});

onMounted(() => {
  watchEffect(() => {
    if (invalid) {
      fileInput.value?.setCustomValidity(validatorMessage ?? t('components.base.fileInput.invalid'));
    } else {
      fileInput.value?.setCustomValidity('');
    }
  }, { flush: 'pre' });
});

const select = async () => {
  isSelecting.value = true;
  try {
    const selected = await openPathDialog(false, false);
    path.value = selected;
    emit('update:modelValue', selected);
  } catch (e) {
    console.error(e);
  } finally {
    isSelecting.value = false;
  }
};
</script>
