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

      <div v-if="!hasAdvancedSelection" class="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
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

      <p v-if="displaySimpleValidationError" class="label mt-0 pt-0 text-xs text-error">
        {{ t(`inputFilters.playlistSelection.errors.${simpleValidationError}`) }}
      </p>

      <p v-if="hasSelection && selectedEntries.length === 0 && !validationError" class="label text-xs text-error">
        {{ t('inputFilters.playlistSelection.noMatches') }}
      </p>

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

    <dialog ref="advancedDialog" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="text-lg font-semibold">{{ t('inputFilters.playlistSelection.advancedTitle') }}</h3>
        <p class="mb-4 text-sm text-base-content/70">
          {{ t('inputFilters.playlistSelection.advancedHint') }}
        </p>

        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap gap-2">
            <base-button type="button" class="btn-sm btn-soft" @click="addRow('single')">
              {{ t('inputFilters.playlistSelection.addSingle') }}
            </base-button>
            <base-button type="button" class="btn-sm btn-soft" @click="addRow('range')">
              {{ t('inputFilters.playlistSelection.addRange') }}
            </base-button>
          </div>

          <div v-if="advancedDraft.rows.length === 0" class="rounded-box bg-base-100 px-4 py-3 text-sm text-base-content/70">
            {{ t('inputFilters.playlistSelection.advancedEmpty') }}
          </div>

          <div v-else class="rounded-box border border-base-300 bg-base-200/60">
            <div class="flex items-center justify-between gap-3 border-b border-base-300 px-3 py-2 text-xs text-base-content/70">
              <span>{{ t('inputFilters.playlistSelection.advancedDescription') }}</span>
              <span>{{ advancedDraft.rows.length }}</span>
            </div>

            <div class="playlist-selection-scroll flex max-h-80 flex-col gap-2 overflow-y-auto p-2 pr-3">
              <article
                v-for="row in advancedDraft.rows"
                :key="row.id"
                class="rounded-box bg-base-100 px-3 py-2 shadow-sm"
              >
                <div class="flex flex-col gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="join">
                      <button
                        type="button"
                        class="btn btn-sm join-item"
                        :class="row.type === 'single' ? 'btn-primary' : 'btn-soft'"
                        @click="setRowType(row.id, 'single')"
                      >
                        {{ t('inputFilters.playlistSelection.row.single') }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm join-item"
                        :class="row.type === 'range' ? 'btn-primary' : 'btn-soft'"
                        @click="setRowType(row.id, 'range')"
                      >
                        {{ t('inputFilters.playlistSelection.row.range') }}
                      </button>
                    </div>

                    <div v-if="row.type === 'single'" class="flex min-w-0 flex-1 items-center gap-2">
                      <label class="shrink-0 text-xs font-semibold" :for="`playlist-row-index-${row.id}`">
                        {{ t('inputFilters.playlistSelection.fields.index') }}
                      </label>
                      <input
                        :id="`playlist-row-index-${row.id}`"
                        v-model.number="row.index"
                        type="number"
                        step="1"
                        class="input input-sm w-full"
                        :class="{ 'input-error': advancedRowErrors[row.id] }"
                        :placeholder="t('inputFilters.playlistSelection.fields.indexPlaceholder')"
                      />
                    </div>

                    <div v-else class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <label class="shrink-0 text-xs font-semibold" :for="`playlist-row-start-${row.id}`">
                        {{ t('inputFilters.playlistSelection.fields.start') }}
                      </label>
                      <input
                        :id="`playlist-row-start-${row.id}`"
                        v-model.number="row.start"
                        type="number"
                        step="1"
                        class="input input-sm w-24"
                        :class="{ 'input-error': advancedRowErrors[row.id] }"
                        :placeholder="t('inputFilters.playlistSelection.fields.startPlaceholder')"
                      />
                      <label class="shrink-0 text-xs font-semibold" :for="`playlist-row-end-${row.id}`">
                        {{ t('inputFilters.playlistSelection.fields.end') }}
                      </label>
                      <input
                        :id="`playlist-row-end-${row.id}`"
                        v-model.number="row.end"
                        type="number"
                        step="1"
                        class="input input-sm w-24"
                        :class="{ 'input-error': advancedRowErrors[row.id] }"
                        :placeholder="t('inputFilters.playlistSelection.fields.endPlaceholder')"
                      />
                    </div>

                    <base-button type="button" class="btn-sm btn-soft ml-auto" @click="removeRow(row.id)">
                      {{ t('inputFilters.playlistSelection.remove') }}
                    </base-button>
                  </div>

                  <p v-if="advancedRowErrors[row.id]" class="label pt-0 text-xs text-error">
                    {{ t(`inputFilters.playlistSelection.errors.${advancedRowErrors[row.id]}`) }}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <form method="dialog">
            <base-button type="submit" class="btn-sm btn-soft" @click="cancelAdvanced">
              {{ t('common.back') }}
            </base-button>
          </form>
          <base-button type="button" class="btn-sm btn-primary" :disabled="hasAdvancedValidationErrors" @click="saveAdvanced">
            {{ t('inputFilters.playlistSelection.useAdvanced') }}
          </base-button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="cancelAdvanced">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '../../base/BaseButton.vue';
import { useMediaStore } from '../../../stores/media/media.ts';
import { useToastStore } from '../../../stores/toast.ts';
import type { Group } from '../../../tauri/types/group.ts';
import {
  applyPlaylistSelectionToEntries,
  buildPlaylistItemsSpec,
  clonePlaylistSelection,
  createPlaylistSelectionRow,
  getPlaylistSelectionRowError,
  type PlaylistSelection,
  type PlaylistSelectionRow,
} from '../../../helpers/playlistSelection.ts';

const { t } = useI18n();
const mediaStore = useMediaStore();
const toastStore = useToastStore();

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const simpleStart = ref<number | null>(null);
const simpleEnd = ref<number | null>(null);
const simpleTouched = ref(false);
const advancedSelection = ref<PlaylistSelection>({ rows: [] });
const advancedDraft = ref<PlaylistSelection>({ rows: [] });
const advancedDialog = ref<HTMLDialogElement | null>(null);
const isApplying = ref(false);

const endPlaceholder = computed(() => `${group.entries?.length ?? ''}`);
const hasAdvancedSelection = computed(() => advancedSelection.value.rows.length > 0);
const advancedSpec = computed(() => buildPlaylistItemsSpec(advancedSelection.value));
const simpleValidationError = computed<string | null>(() => {
  if (hasAdvancedSelection.value) {
    return null;
  }

  const isStartEmpty = simpleStart.value == null;
  const isEndEmpty = simpleEnd.value == null;
  if (isStartEmpty && isEndEmpty) {
    return null;
  }

  if (!isValidPlaylistIndex(simpleStart.value) || !isValidPlaylistIndex(simpleEnd.value)) {
    return 'playlistRangeBounds';
  }

  return null;
});
const displaySimpleValidationError = computed(() => simpleTouched.value && simpleValidationError.value);
const advancedRowErrors = computed<Record<string, string | null>>(() => Object.fromEntries(
  advancedDraft.value.rows.map(row => [row.id, getPlaylistSelectionRowError(row)]),
));
const hasAdvancedValidationErrors = computed(() => Object.values(advancedRowErrors.value).some(Boolean));

const selection = computed<PlaylistSelection>(() => {
  if (hasAdvancedSelection.value) {
    return advancedSelection.value;
  }

  if (simpleValidationError.value || (simpleStart.value == null && simpleEnd.value == null)) {
    return { rows: [] };
  }

  return {
    rows: [{
      id: 'playlist-selection-range',
      type: 'range',
      start: simpleStart.value,
      end: simpleEnd.value,
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
  advancedDraft.value = clonePlaylistSelection(advancedSelection.value);
  advancedDialog.value?.showModal();
}

function cancelAdvanced() {
  advancedDraft.value = clonePlaylistSelection(advancedSelection.value);
}

function saveAdvanced() {
  advancedSelection.value = clonePlaylistSelection(advancedDraft.value);
  advancedDialog.value?.close();
}

function clearAdvanced() {
  advancedSelection.value = { rows: [] };
  simpleTouched.value = false;
}

function addRow(type: PlaylistSelectionRow['type']) {
  advancedDraft.value.rows.push(createPlaylistSelectionRow(type));
}

function removeRow(id: string) {
  advancedDraft.value.rows = advancedDraft.value.rows.filter(row => row.id !== id);
}

function setRowType(id: string, type: PlaylistSelectionRow['type']) {
  advancedDraft.value.rows = advancedDraft.value.rows.map(row => (
    row.id === id
      ? (type === 'single' ? { id, type, index: null } : { id, type, start: null, end: null })
      : row
  ));
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
</script>

<style scoped>
.playlist-selection-scroll {
  scrollbar-color: color-mix(in oklab, var(--color-base-content) 35%, transparent) transparent;
  scrollbar-width: thin;
}

.playlist-selection-scroll::-webkit-scrollbar {
  width: 0.7rem;
}

.playlist-selection-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.playlist-selection-scroll::-webkit-scrollbar-thumb {
  border: 0.18rem solid transparent;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--color-base-content) 35%, transparent);
  background-clip: padding-box;
}

.playlist-selection-scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklab, var(--color-base-content) 50%, transparent);
  background-clip: padding-box;
}
</style>
