<template>
  <p class="font-semibold">{{ label }}</p>

  <div class="join group w-full" v-bind="$attrs">
    <div class="relative w-full">
      <label class="input validator join-item w-full">
        <input
            type="text"
            class="cursor-pointer w-full z-0 pr-8 truncate"
            readonly
            :value="inputText"
            required
            role="button"
            aria-haspopup="dialog"
            :aria-label="`${label}: ${inputText}`"
            @click="select"
            @keydown.enter.prevent="select"
            @keydown.space.prevent="select"
        />
      </label>
      <button
          v-if="clearable && path"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-xs btn-circle btn-ghost z-10"
          @click.stop="clear"
      >
        <span class="sr-only">{{ directory ? t('components.base.folderInput.clear') : t('components.base.fileInput.clear') }}</span>
        <x-mark-icon class="w-5 h-5"/>
      </button>
      <div class="validator-hint hidden">{{ validatorMessage }}</div>
    </div>
    <div v-if="showRecent" class="dropdown dropdown-end">
      <button
          class="btn btn-soft join-item"
          type="button"
          tabindex="0"
          :disabled="!hasRecents"
          aria-haspopup="menu"
      >
        <span class="sr-only">{{ directory ? t('components.base.folderInput.recents.open') : t('components.base.fileInput.recents.open') }}</span>
        <chevron-down-icon class="w-5 h-5"/>
      </button>

      <ul tabindex="0" class="dropdown-content menu bg-base-300 rounded-box shadow w-96 p-2">
        <li v-for="recentValue in recentValues" :key="recentValue">
          <button type="button" class="justify-between" @click="selectRecent($event, recentValue)">
            <span tabindex="-1" class="truncate" v-if="!directory" :title="basename(recentValue)">{{ basename(recentValue) }}</span>
            <span tabindex="-1" class="opacity-60 truncate ml-2" v-if="!directory" :title="recentValue">{{ recentValue }}</span>
            <span tabindex="-1" class="truncate ml-2" v-if="directory" :title="recentValue">{{ recentValue }}</span>
          </button>
        </li>

        <li v-if="!hasRecents">
          <span class="opacity-60">{{ directory ? t('components.base.folderInput.recents.empty') : t('components.base.fileInput.recents.empty') }}</span>
        </li>

        <li class="mt-1" v-if="hasRecents">
          <button type="button" class="text-error hover:bg-error/10" @click="clearRecents">
            <trash-icon class="w-5 h-5"/>
            {{ directory ? t('components.base.folderInput.recents.clear') : t('components.base.fileInput.recents.clear') }}
          </button>
        </li>
      </ul>
    </div>
    <button
        v-else
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
import { XMarkIcon, TrashIcon, ChevronDownIcon } from '@heroicons/vue/24/solid';

const { openPathDialog } = useDialog();
const { t } = useI18n();

const emit = defineEmits(['update:modelValue', 'clearRecents']);
defineOptions({
  inheritAttrs: false,
});

const isSelecting = ref(false);
const hasRecents = computed(() => (recentValues?.length ?? 0) > 0);
const path = defineModel({ type: String as PropType<string | null>, required: false, default: null });
const fileInput = ref<HTMLInputElement | null>(null);

const { label, invalid, clearable, directory, showRecent, validatorMessage, recentValues } = defineProps({
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
  directory: {
    type: Boolean,
    required: false,
    default: false,
  },
  validatorMessage: {
    type: String,
    required: false,
  },
  showRecent: {
    type: Boolean,
    required: false,
    default: false,
  },
  recentValues: {
    type: Array as PropType<string[]>,
    required: false,
    default: () => [],
  },
  recentTitle: {},
});

const inputText = computed(() => {
  const placeholderText = directory ? t('components.base.folderInput.placeholder') : t('components.base.fileInput.placeholder');
  return path.value ?? placeholderText;
});

onMounted(() => {
  const invalidText = directory ? t('components.base.folderInput.invalid') : t('components.base.fileInput.invalid');
  watchEffect(() => {
    if (invalid) {
      fileInput.value?.setCustomValidity(validatorMessage ?? invalidText);
    } else {
      fileInput.value?.setCustomValidity('');
    }
  }, { flush: 'pre' });
});

const select = async () => {
  isSelecting.value = true;
  try {
    const selected = await openPathDialog(false, directory);
    if (!clearable && !selected) return;
    path.value = selected;
    emit('update:modelValue', selected);
  } catch (e) {
    console.error(e);
  } finally {
    isSelecting.value = false;
  }
};

const selectRecent = (event: Event, value: string) => {
  path.value = value;
  emit('update:modelValue', value);
  blurFromEvent(event);
};

const clear = () => {
  path.value = null;
  emit('update:modelValue', null);
};

function clearRecents(event: Event) {
  emit('clearRecents');
  blurFromEvent(event);
}

function basename(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const lastSegmentIndex = normalized.lastIndexOf('/');
  return lastSegmentIndex >= 0 ? normalized.slice(lastSegmentIndex + 1) : normalized;
}

function blurFromEvent(event: Event) {
  const target = event.target as HTMLElement | null;
  target?.blur();
}
</script>
