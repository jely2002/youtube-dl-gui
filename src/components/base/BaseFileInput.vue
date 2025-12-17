<template>
  <p class="font-semibold">{{ label }}</p>

  <div class="join group w-full" v-bind="$attrs">
    <div class="relative w-full">
      <label class="input validator join-item w-full pr-10">
        <input
            ref="fileInput"
            type="text"
            class="cursor-pointer w-full"
            readonly
            :value="inputText"
            required
            @click="select"
        />
      </label>
      <button
          v-if="clearable && path"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-xs btn-circle btn-ghost transition-opacity"
          @click.stop="clear"
          aria-label="Clear"
      >
        <x-mark-icon class="w-5 h-5"/>
      </button>
      <div class="validator-hint hidden">{{ validatorMessage }}</div>
    </div>
    <button
        @click="select"
        type="button"
        class="btn btn-soft join-item group-focus-within:bg-base-200
       group-focus-within:border-base-300"
    >
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
import { XMarkIcon } from '@heroicons/vue/24/solid';

const { openPathDialog } = useDialog();
const { t } = useI18n();

const emit = defineEmits(['update:modelValue']);
defineOptions({
  inheritAttrs: false,
});

const isSelecting = ref(false);
const path = defineModel({ type: String as PropType<string | null>, required: false, default: null });
const fileInput = ref<HTMLInputElement | null>(null);

const { invalid, clearable, validatorMessage, label } = defineProps({
  label: {
    type: String,
    required: true,
  },
  invalid: {
    type: Boolean,
    required: false,
    default: false,
  },
  clearable: {
    type: Boolean,
    required: false,
    default: true,
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

const clear = () => {
  path.value = null;
  emit('update:modelValue', null);
};
</script>
