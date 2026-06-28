<template>
  <div class="card-body py-0 pr-0 grow w-full min-w-0 overflow-hidden">
    <div class="flex h-full min-h-0 flex-col gap-2">
      <div class="flex items-center justify-between">
        <h2
          :title="group.title ?? group.url"
          class="card-title block overflow-hidden text-ellipsis text-base leading-8 text-nowrap"
        >
          {{ group.title ?? group.url }}
        </h2>
        <span class="shrink-0 text-xs text-base-content/70 ml-2">{{ selectionSummary }}</span>
      </div>

      <p class="text-xs font-semibold flex-initial">
        {{ t('inputFilters.playlistSelection.description') }}
      </p>

      <div v-if="!hasAdvancedSelection" class="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center mr-1 gap-1.5">
        <label class="text-xs font-semibold" for="playlist-selection-start">
          {{ t('inputFilters.playlistSelection.fields.start') }}
        </label>
        <input
          id="playlist-selection-start"
          v-model.number="simpleStart"
          type="number"
          step="1"
          class="input w-full"
          :class="{ 'input-error': displaySimpleValidationError }"
          :placeholder="t('inputFilters.playlistSelection.fields.startPlaceholder')"
          @blur="simpleTouched = true"
        />
        <label class="text-xs font-semibold" for="playlist-selection-end">
          {{ t('inputFilters.playlistSelection.fields.end') }}
        </label>
        <input
          id="playlist-selection-end"
          v-model.number="simpleEnd"
          type="number"
          step="1"
          class="input w-full"
          :class="{ 'input-error': displaySimpleValidationError }"
          :placeholder="endPlaceholder"
          @blur="simpleTouched = true"
        />
      </div>

      <div v-else class="rounded-box bg-base-100 px-3 py-2 text-sm text-base-content/80">
        <span class="font-semibold">{{ t('inputFilters.playlistSelection.fields.advancedLabel') }}</span>
        <code class="ml-2 text-xs">{{ advancedSpec }}</code>
      </div>

      <div class="mt-auto mb-1 flex flex-wrap gap-2">
        <base-button type="button" class="btn-soft" @click="openAdvanced">
          {{ t('inputFilters.playlistSelection.advancedButton') }}
        </base-button>
        <base-button
          v-if="hasAdvancedSelection"
          type="button"
          class="btn-soft"
          :disabled="isApplying"
          @click="clearAdvanced"
        >
          {{ t('inputFilters.playlistSelection.simpleButton') }}
        </base-button>
        <base-button
          type="button"
          class="btn-primary"
          :disabled="isApplying || !!validationError || (hasSelection && selectedEntries.length === 0)"
          :loading="isApplying"
          @click="applySelection"
        >
          {{ hasSelection ? t('inputFilters.playlistSelection.applySelection') : t('inputFilters.playlistSelection.applyFull') }}
        </base-button>
      </div>
    </div>

    <playlist-selection-modal
      ref="advancedModal"
      @apply="saveAdvanced"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '../../base/BaseButton.vue';
import PlaylistSelectionModal from './PlaylistSelectionModal.vue';
import { useMediaStore } from '../../../stores/media/media.ts';
import { useToastStore } from '../../../stores/toast.ts';
import type { Group } from '../../../tauri/types/group.ts';
import {
  applyPlaylistSelectionToEntries,
  buildPlaylistItemsSpec,
  type PlaylistSelection,
} from '../../../helpers/playlistSelection.ts';

const { t } = useI18n();
const mediaStore = useMediaStore();
const toastStore = useToastStore();

type PlaylistSelectionModalApi = {
  open: (selection: PlaylistSelection) => void;
};

type SimplePlaylistIndex = number | '' | null;

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const simpleStart = ref<SimplePlaylistIndex>(null);
const simpleEnd = ref<SimplePlaylistIndex>(null);
const simpleTouched = ref(false);
const advancedSelection = ref<PlaylistSelection>({ rows: [] });
const advancedModal = ref<PlaylistSelectionModalApi | null>(null);
const isApplying = ref(false);

const endPlaceholder = computed(() => `${group.entries?.length ?? ''}`);
const hasAdvancedSelection = computed(() => advancedSelection.value.rows.length > 0);
const advancedSpec = computed(() => buildPlaylistItemsSpec(advancedSelection.value));
const normalizedSimpleStart = computed(() => normalizeSimplePlaylistIndex(simpleStart.value));
const normalizedSimpleEnd = computed(() => normalizeSimplePlaylistIndex(simpleEnd.value));
const simpleValidationError = computed<string | null>(() => {
  if (hasAdvancedSelection.value) {
    return null;
  }

  const isStartEmpty = normalizedSimpleStart.value == null;
  const isEndEmpty = normalizedSimpleEnd.value == null;
  if (isStartEmpty && isEndEmpty) {
    return null;
  }

  if (normalizedSimpleStart.value == null || normalizedSimpleEnd.value == null) {
    return 'playlistRangeBounds';
  }

  return null;
});
const displaySimpleValidationError = computed(() => simpleTouched.value && simpleValidationError.value);

const selection = computed<PlaylistSelection>(() => {
  if (hasAdvancedSelection.value) {
    return advancedSelection.value;
  }

  if (
    simpleValidationError.value
    || (normalizedSimpleStart.value == null && normalizedSimpleEnd.value == null)
  ) {
    return { rows: [] };
  }

  return {
    rows: [{
      id: 'playlist-selection-range',
      type: 'range',
      start: normalizedSimpleStart.value,
      end: normalizedSimpleEnd.value,
    }],
  };
});

const selectedEntries = computed(() => applyPlaylistSelectionToEntries(group.entries ?? [], selection.value));
const hasSelection = computed(() => selection.value.rows.length > 0);
const validationError = computed(() => hasAdvancedSelection.value ? null : simpleValidationError.value);
const selectionSummary = computed(() => {
  const total = group.entries?.length ?? 0;
  const count = hasSelection.value ? selectedEntries.value.length : total;
  return total === count
    ? t('inputFilters.playlistSelection.selectionSummaryAll', { count })
    : t('inputFilters.playlistSelection.selectionSummary', { count, total });
});

function openAdvanced() {
  advancedModal.value?.open(advancedSelection.value);
}

function saveAdvanced(value: PlaylistSelection) {
  advancedSelection.value = value;
}

function clearAdvanced() {
  advancedSelection.value = { rows: [] };
  simpleTouched.value = false;
}

async function applySelection() {
  simpleTouched.value = true;
  isApplying.value = true;
  try {
    await mediaStore.expandPlaylistGroup(group.id, selection.value);
  } catch (error) {
    console.error(error);
    toastStore.showToast(String(error), { style: 'error' });
  } finally {
    isApplying.value = false;
  }
}

function isValidPlaylistIndex(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value !== 0;
}

function normalizeSimplePlaylistIndex(value: SimplePlaylistIndex): number | null {
  return typeof value === 'number' && isValidPlaylistIndex(value) ? value : null;
}
</script>
