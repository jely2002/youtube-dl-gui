<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-box bg-base-100 p-4">
      <div class="grid gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block font-semibold" :for="`selection-mode-${selection.id}`">
              {{ t('settings.output.partialDownload.use') }}
            </label>
            <select
              :id="`selection-mode-${selection.id}`"
              v-model="selection.mode"
              class="select w-full text-sm"
              @change="onModeChange"
            >
              <option value="time">{{ t('settings.output.partialDownload.useTimes') }}</option>
              <option value="chapter" :disabled="!hasChapterOptions">
                {{ t('settings.output.partialDownload.useChapter') }}
              </option>
            </select>
          </div>

          <div class="self-end">
            <BaseButton
              type="button"
              class="btn btn-sm h-10 w-full"
              @click="resetSelection"
            >
              {{ t('settings.reset.label') }}
            </BaseButton>
          </div>
        </div>

        <div
          v-if="selection.mode === 'chapter' && hasChapterOptions"
        >
          <label class="mb-1 block font-semibold" :for="`selection-chapter-${selection.id}`">
            {{ t('settings.output.partialDownload.chapter') }}
          </label>
          <select
            :id="`selection-chapter-${selection.id}`"
            v-model="selection.chapterKey"
            class="select w-full text-sm"
            @change="applyChapterSelection"
          >
            <option
              v-for="option in chapterSelectionOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <div
          v-else
          class="grid grid-cols-2 gap-3"
        >
          <div>
            <label class="mb-1 block font-semibold" :for="`selection-start-${selection.id}`">
              {{ t('settings.output.partialDownload.startAt') }}
            </label>
            <input
              :id="`selection-start-${selection.id}`"
              v-model="selection.start"
              type="text"
              class="input w-full text-sm"
              :class="{ 'input-error': !!selectionError.start }"
              @blur="normalizeField('start')"
            />
            <p v-if="selectionError.start" class="mt-1 text-error">
              {{ t(`settings.output.partialDownload.errors.${selectionError.start}`) }}
            </p>
          </div>

          <div>
            <label class="mb-1 block font-semibold" :for="`selection-end-${selection.id}`">
              {{ t('settings.output.partialDownload.stopAt') }}
            </label>
            <input
              :id="`selection-end-${selection.id}`"
              v-model="selection.end"
              type="text"
              class="input w-full text-sm"
              :class="{ 'input-error': !!selectionError.end }"
              @blur="normalizeField('end')"
            />
            <p v-if="selectionError.end" class="mt-1 text-error">
              {{ t(`settings.output.partialDownload.errors.${selectionError.end}`) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasInvalidSelection" role="alert" class="alert alert-warning alert-soft">
      <ExclamationTriangleIcon class="h-5 w-5" />
      <span>{{ t('settings.output.partialDownload.invalidHint') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/solid';
import BaseButton from './BaseButton.vue';
import {
  createDefaultSection,
  formatSecondsAsClock,
  normalizeTimestampInput,
  type PartialDownloadSelection,
  validateSelection,
} from '../../helpers/partialDownload.ts';
import { Chapter } from '../../tauri/types/media.ts';

interface ChapterOption {
  value: string;
  label: string;
  chapter?: Chapter;
}

const ALL_CHAPTERS_VALUE = '__all__';

const selection = defineModel<PartialDownloadSelection>({ required: true });

const props = defineProps({
  chapters: {
    type: Array as PropType<Chapter[]>,
    required: true,
  },
  durationSeconds: {
    type: Number,
    required: false,
    default: undefined,
  },
});

const { t } = useI18n();

const chapterOptions = computed<ChapterOption[]>(() =>
  props.chapters.map((chapter, index) => ({
    value: `${index}:${chapter.startTime}:${chapter.endTime}`,
    chapter,
    label: `${chapter.title} (${formatSecondsAsClock(Math.floor(chapter.startTime))} - ${formatSecondsAsClock(Math.floor(chapter.endTime))})`,
  })),
);
const chapterSelectionOptions = computed<ChapterOption[]>(() => (
  chapterOptions.value.length > 0
    ? [{ value: ALL_CHAPTERS_VALUE, label: t('settings.output.partialDownload.allChapters') }, ...chapterOptions.value]
    : []
));
const chapterOptionMap = computed(() =>
  new Map(chapterSelectionOptions.value.map(option => [option.value, option])),
);
const hasChapterOptions = computed(() => chapterOptions.value.length > 0);
const selectionError = computed(() => validateSelection(selection.value, props.durationSeconds));
const hasInvalidSelection = computed(() =>
  selectionError.value.start !== null || selectionError.value.end !== null,
);

function resetRange() {
  const defaults = createDefaultSection(selection.value.id, props.durationSeconds);
  selection.value.start = defaults.start;
  selection.value.end = defaults.end;
}

function resetSelection() {
  const canUseChapterMode = selection.value.mode === 'chapter' && hasChapterOptions.value;
  selection.value.chapterKey = canUseChapterMode ? ALL_CHAPTERS_VALUE : '';
  resetRange();
}

function normalizeField(field: 'start' | 'end') {
  if (selection.value.mode === 'chapter') return;
  const normalized = normalizeTimestampInput(selection.value[field]);
  if (normalized) {
    selection.value[field] = normalized;
  }
}

function applyChapterSelection() {
  const selected = chapterOptionMap.value.get(selection.value.chapterKey);
  if (!selected?.chapter) {
    resetRange();
    return;
  }

  selection.value.start = formatSecondsAsClock(Math.floor(selected.chapter.startTime));
  selection.value.end = formatSecondsAsClock(Math.floor(selected.chapter.endTime));
}

function onModeChange() {
  if (selection.value.mode !== 'chapter') return;
  if (!selection.value.chapterKey) {
    selection.value.chapterKey = ALL_CHAPTERS_VALUE;
  }
  applyChapterSelection();
}
</script>
