<template>
  <dialog ref="dialog" class="modal">
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

        <div v-if="draft.rows.length === 0" class="rounded-box bg-base-100 px-4 py-3 text-sm text-base-content/70">
          {{ t('inputFilters.playlistSelection.advancedEmpty') }}
        </div>

        <div v-else class="rounded-box border border-base-300 bg-base-200/60">
          <div class="flex items-center justify-between gap-3 border-b border-base-300 px-3 py-2 text-xs text-base-content/70">
            <span>{{ t('inputFilters.playlistSelection.advancedDescription') }}</span>
            <span>{{ draft.rows.length }}</span>
          </div>

          <div class="playlist-selection-scroll flex max-h-80 flex-col gap-2 overflow-y-auto p-2 pr-3">
            <article
              v-for="row in draft.rows"
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
                      :class="{ 'input-error': rowErrors[row.id] }"
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
                      :class="{ 'input-error': rowErrors[row.id] }"
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
                      :class="{ 'input-error': rowErrors[row.id] }"
                      :placeholder="t('inputFilters.playlistSelection.fields.endPlaceholder')"
                    />
                  </div>

                  <base-button type="button" class="btn-sm btn-soft ml-auto" @click="removeRow(row.id)">
                    {{ t('inputFilters.playlistSelection.remove') }}
                  </base-button>
                </div>

                <p v-if="rowErrors[row.id]" class="label pt-0 text-xs text-error">
                  {{ t(`inputFilters.playlistSelection.errors.${rowErrors[row.id]}`) }}
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <form method="dialog">
          <base-button type="submit" class="btn-sm btn-soft" @click="cancel">
            {{ t('common.back') }}
          </base-button>
        </form>
        <base-button type="button" class="btn-sm btn-primary" :disabled="hasValidationErrors" @click="save">
          {{ t('inputFilters.playlistSelection.useAdvanced') }}
        </base-button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button :aria-label="t('common.back')" @click="cancel"></button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '../../base/BaseButton.vue';
import {
  clonePlaylistSelection,
  createPlaylistSelectionRow,
  getPlaylistSelectionRowError,
  type PlaylistSelection,
  type PlaylistSelectionRow,
} from '../../../helpers/playlistSelection.ts';

const emit = defineEmits<{
  apply: [selection: PlaylistSelection];
}>();

const { t } = useI18n();

const dialog = ref<HTMLDialogElement | null>(null);
const draft = ref<PlaylistSelection>({ rows: [] });
const rowErrors = computed<Record<string, string | null>>(() => Object.fromEntries(
  draft.value.rows.map(row => [row.id, getPlaylistSelectionRowError(row)]),
));
const hasValidationErrors = computed(() => Object.values(rowErrors.value).some(Boolean));

function open(selection: PlaylistSelection) {
  draft.value = clonePlaylistSelection(selection);
  dialog.value?.showModal();
}

function cancel() {
  dialog.value?.close();
}

function save() {
  emit('apply', clonePlaylistSelection(draft.value));
  dialog.value?.close();
}

function addRow(type: PlaylistSelectionRow['type']) {
  draft.value.rows.push(createPlaylistSelectionRow(type));
}

function removeRow(id: string) {
  draft.value.rows = draft.value.rows.filter(row => row.id !== id);
}

function setRowType(id: string, type: PlaylistSelectionRow['type']) {
  draft.value.rows = draft.value.rows.map(row => (
    row.id === id
      ? (type === 'single' ? { id, type, index: null } : { id, type, start: null, end: null })
      : row
  ));
}

defineExpose({
  open,
});
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
