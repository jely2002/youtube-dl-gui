<template>
  <form @submit.prevent="save">
    <base-sub-nav>
      <template #default>
        <base-button
          type="button"
          :disabled="!canReset || isSaving"
          @click="reset"
        >
          {{ t('settings.reset.label') }}
        </base-button>
        <base-button
          type="submit"
          class="btn-primary"
          :disabled="!hasChanges"
          :loading="isSaving"
        >
          {{ t('common.save') }}
        </base-button>
      </template>
      <template #title>
        <h1 class="self-center text-lg font-semibold">{{ t('inputFilters.title') }}</h1>
      </template>
    </base-sub-nav>

    <section class="flex flex-col gap-4 px-8 py-4">
      <base-fieldset
        :legend="t('inputFilters.dates.legend')"
        :label="t('inputFilters.dates.hint')"
      >
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <span class="font-semibold">{{ t('inputFilters.fields.date.presetsLabel') }}</span>
            <div class="max-w-sm">
              <select
                id="input-filters-date-preset"
                v-model="selectedDatePreset"
                class="select w-full"
              >
                <option :value="null">{{ t('inputFilters.fields.date.clearMode') }}</option>
                <option
                  v-for="preset in datePresets"
                  :key="preset.value"
                  :value="preset.value"
                >
                  {{ preset.label }}
                </option>
              </select>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-semibold">{{ t('inputFilters.fields.date.modeLabel') }}</span>
            <div class="join w-fit max-w-full flex-wrap">
              <button
                v-for="option in dateModeOptions"
                :key="option.value"
                type="button"
                class="btn join-item"
                :class="dateFilter.mode === option.value ? 'btn-primary' : 'btn-soft'"
                @click="dateFilter.mode = option.value"
              >
                {{ option.label }}
              </button>
              <button
                type="button"
                class="btn join-item"
                :class="dateFilter.mode === null ? 'btn-primary' : 'btn-soft'"
                @click="clearDateFilter"
              >
                {{ t('inputFilters.fields.date.clearMode') }}
              </button>
            </div>
          </div>

          <div class="flex max-w-md flex-col gap-1">
            <label class="font-semibold" for="input-filters-date">
              {{ activeDateLabel }}
            </label>
            <input
              id="input-filters-date"
              v-model="dateFilter.value"
              type="date"
              class="input validator w-full"
              :disabled="dateFilter.mode === null"
            />
            <p class="label">{{ t('inputFilters.fields.date.hint') }}</p>
          </div>
        </div>
      </base-fieldset>

      <base-fieldset
        :legend="t('inputFilters.filesize.legend')"
        :label="t('inputFilters.filesize.hint')"
      >
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="input-filters-min-size">
              {{ t('inputFilters.fields.minSize.label') }}
            </label>
            <div class="join w-full max-w-md">
              <div class="input join-item w-full">
                <input
                  id="input-filters-min-size"
                  v-model.number="minSize.value"
                  type="number"
                  min="0"
                  step="0.1"
                  class="grow"
                  :placeholder="t('inputFilters.fields.size.valuePlaceholder')"
                />
              </div>
              <select
                v-model="minSize.unit"
                class="select join-item w-28"
              >
                <option v-for="unit in sizeUnits" :key="unit" :value="unit">{{ unit }}</option>
              </select>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="input-filters-max-size">
              {{ t('inputFilters.fields.maxSize.label') }}
            </label>
            <div class="join w-full max-w-md">
              <div class="input join-item w-full">
                <input
                  id="input-filters-max-size"
                  v-model.number="maxSize.value"
                  type="number"
                  min="0"
                  step="0.1"
                  class="grow"
                  :placeholder="t('inputFilters.fields.size.valuePlaceholder')"
                />
              </div>
              <select
                v-model="maxSize.unit"
                class="select join-item w-28"
              >
                <option v-for="unit in sizeUnits" :key="unit" :value="unit">{{ unit }}</option>
              </select>
            </div>
          </div>
        </div>
      </base-fieldset>

      <base-fieldset
        :legend="t('inputFilters.advanced.legend')"
        :label="t('inputFilters.advanced.hint')"
      >
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="input-filters-match-filters">
              {{ t('inputFilters.fields.matchFilters.label') }}
            </label>
            <textarea
              id="input-filters-match-filters"
              v-model="draft.matchFilters"
              class="textarea min-h-28 w-full max-w-4xl"
              :placeholder="t('inputFilters.fields.matchFilters.placeholder')"
            />
            <p class="label">{{ t('inputFilters.fields.matchFilters.hint') }}</p>
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="input-filters-break-match-filters">
              {{ t('inputFilters.fields.breakMatchFilters.label') }}
            </label>
            <textarea
              id="input-filters-break-match-filters"
              v-model="draft.breakMatchFilters"
              class="textarea min-h-28 w-full max-w-4xl"
              :placeholder="t('inputFilters.fields.breakMatchFilters.placeholder')"
            />
            <p class="label">{{ t('inputFilters.fields.breakMatchFilters.hint') }}</p>
          </div>
        </div>
      </base-fieldset>
    </section>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '../../components/base/BaseButton.vue';
import BaseFieldset from '../../components/base/BaseFieldset.vue';
import BaseSubNav from '../../components/base/BaseSubNav.vue';
import {
  applyDatePreset,
  cloneInputFilterSettings,
  createDefaultInputFilterSettings,
  normalizeInputFilterSettings,
  INPUT_FILTER_DATE_PRESETS,
  INPUT_FILTER_SIZE_UNITS,
  type InputFilterDatePreset,
} from '../../helpers/inputFilters.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { useToastStore } from '../../stores/toast.ts';
import type { InputFilterSettings } from '../../tauri/types/config.ts';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const toastStore = useToastStore();

const draft = ref<InputFilterSettings>(
  cloneInputFilterSettings(settingsStore.settings.inputFilters),
);
const isSaving = ref(false);

const sizeUnits = INPUT_FILTER_SIZE_UNITS;
const dateModeOptions = computed(() => [
  { value: 'exact' as const, label: t('inputFilters.fields.date.mode.exact') },
  { value: 'before' as const, label: t('inputFilters.fields.date.mode.before') },
  { value: 'after' as const, label: t('inputFilters.fields.date.mode.after') },
]);
const datePresets = computed(() => INPUT_FILTER_DATE_PRESETS.map(value => ({
  value,
  label: t(`inputFilters.fields.date.presets.${value}`),
})));
const selectedDatePreset = computed<InputFilterDatePreset | null>({
  get: () => {
    const current = JSON.stringify(normalizeInputFilterSettings({
      ...createDefaultInputFilterSettings(),
      dateFilter: dateFilter.value,
    }).dateFilter);

    for (const preset of INPUT_FILTER_DATE_PRESETS) {
      const presetValue = JSON.stringify(applyDatePreset(preset));
      if (presetValue === current) {
        return preset;
      }
    }

    return null;
  },
  set: (value) => {
    if (value === null) {
      clearDateFilter();
      return;
    }
    selectDatePreset(value);
  },
});

const dateFilter = computed({
  get: () => draft.value.dateFilter,
  set: (value) => {
    draft.value.dateFilter = value;
  },
});
const minSize = computed({
  get: () => draft.value.minSize,
  set: (value) => {
    draft.value.minSize = value;
  },
});
const maxSize = computed({
  get: () => draft.value.maxSize,
  set: (value) => {
    draft.value.maxSize = value;
  },
});

const normalizedDraft = computed(() => normalizeInputFilterSettings(draft.value));
const normalizedStore = computed(() => normalizeInputFilterSettings(settingsStore.settings.inputFilters));
const normalizedDefaults = computed(() => normalizeInputFilterSettings(createDefaultInputFilterSettings()));
const hasChanges = computed(() => JSON.stringify(normalizedDraft.value) !== JSON.stringify(normalizedStore.value));
const canReset = computed(() => JSON.stringify(normalizedDraft.value) !== JSON.stringify(normalizedDefaults.value));
const activeDateLabel = computed(() => {
  switch (dateFilter.value.mode) {
    case 'before':
      return t('inputFilters.fields.date.activeLabel.before');
    case 'after':
      return t('inputFilters.fields.date.activeLabel.after');
    case 'exact':
    default:
      return t('inputFilters.fields.date.activeLabel.exact');
  }
});

watch(
  () => settingsStore.settings.inputFilters,
  (value) => {
    draft.value = cloneInputFilterSettings(value);
  },
  { deep: true },
);

function clearDateFilter() {
  dateFilter.value = {
    mode: null,
    value: null,
  };
}

function selectDatePreset(preset: InputFilterDatePreset) {
  dateFilter.value = applyDatePreset(preset);
}

async function save() {
  const normalized = normalizeInputFilterSettings(draft.value);

  isSaving.value = true;
  try {
    await settingsStore.patch({ inputFilters: normalized });
    draft.value = cloneInputFilterSettings(normalized);
    toastStore.showToast(t('inputFilters.toasts.saved'), { style: 'success' });
  } catch (error) {
    console.error(error);
    toastStore.showToast(t('inputFilters.toasts.error', { error: String(error) }), {
      style: 'error',
    });
  } finally {
    isSaving.value = false;
  }
}

function reset() {
  draft.value = createDefaultInputFilterSettings();
}
</script>
