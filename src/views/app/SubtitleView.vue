<template>
  <form @submit.prevent="save">
    <base-sub-nav>
      <template #default>
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
        <h1 class="self-center text-lg font-semibold">{{ t('subtitles.title') }}</h1>
      </template>
    </base-sub-nav>

    <section class="flex flex-col px-8 py-4">
      <base-fieldset
        :legend="t('subtitles.options.languages.legend')"
        :label="t('subtitles.options.languages.legendLabel')"
      >
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <input
              id="all-languages"
              type="checkbox"
              class="toggle toggle-primary"
              :checked="isAllSelected"
              @change="toggleAllLanguages"
            />
            <label class="text-sm text-base-content/70" for="all-languages">
              {{ t('subtitles.options.languages.downloadAll') }}
            </label>
          </div>

          <div class="w-full flex flex-col md:w-96">
            <label class="label" for="languageSearch">
              <span class="label-text mb-2 font-semibold">
                {{ t('subtitles.options.languages.search') }}
              </span>
            </label>
            <input
              id="languageSearch"
              v-model="languageQuery"
              type="search"
              class="input input-bordered"
              :placeholder="t('subtitles.options.languages.searchPlaceholder')"
            />
          </div>

          <ul class="max-h-72 overflow-y-auto rounded-lg border border-base-300">
            <li
              v-for="option in filteredLanguageOptions"
              :key="option.code"
              class="border-b border-base-300 last:border-b-0"
            >
              <label class="flex cursor-pointer items-center gap-3 px-4 py-2">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  :checked="isLanguageSelected(option.code)"
                  :disabled="isAllSelected"
                  @change="toggleLanguage(option.code)"
                />
                <span class="flex flex-col">
                  <span class="font-medium">{{ option.englishName }}</span>
                  <span
                    v-if="option.nativeName && option.nativeName !== option.englishName"
                    class="text-xs text-base-content/60"
                  >
                    {{ option.nativeName }}
                  </span>
                </span>
              </label>
            </li>
            <li v-if="!filteredLanguageOptions.length" class="px-4 py-6 text-center text-sm text-base-content/60">
              {{ t('subtitles.options.languages.noResult', { query: languageQuery }) }}
            </li>
          </ul>

          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="font-semibold">{{ t('subtitles.options.languages.selected') }}</span>
            <template v-if="isAllSelected">
              <span class="badge badge-soft badge-info">
                {{ t('subtitles.options.languages.allSelected') }}
              </span>
            </template>
            <template v-else>
              <span
                v-if="selectedLanguageBadges.length === 0"
                class="badge badge-soft"
              >
                {{ t('subtitles.options.languages.none') }}
              </span>
              <span
                v-for="label in selectedLanguageBadges"
                :key="label"
                class="badge badge-soft"
              >
                {{ label }}
              </span>
            </template>
          </div>
        </div>
      </base-fieldset>

      <div class="divider my-0" />

      <base-fieldset
        :legend="t('subtitles.options.format.label')"
        :label="t('subtitles.options.format.legendLabel')"
      >
        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="format-select">
              {{ t('subtitles.options.format.label') }}
            </label>
            <select
              id="format-select"
              v-model="primaryFormat"
              class="select select-bordered w-full max-w-xs"
            >
              <option
                v-for="format in subtitleFormatOptions"
                :key="format.value"
                :value="format.value"
              >
                {{ format.label }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="embed-subtitles">
              {{ t('subtitles.options.embed.label') }}
            </label>
            <input
              id="embed-subtitles"
              v-model="subtitleSettings.embedSubtitles"
              type="checkbox"
              class="toggle toggle-primary my-1"
            />
            <p class="label">
              {{ t('subtitles.options.embed.hint') }}
            </p>
          </div>
        </div>
      </base-fieldset>
    </section>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BaseButton from '../../components/base/BaseButton.vue';
import BaseFieldset from '../../components/base/BaseFieldset.vue';
import BaseSubNav from '../../components/base/BaseSubNav.vue';
import {
  languageOptions,
  getSubtitleLanguageLabel,
  type SubtitleLanguageOption,
} from '../../helpers/subtitles/languages.ts';
import {
  areSubtitleSettingsEqual,
  buildSubtitleFormatOptions,
  createSubtitleSettings,
  getPrimarySubtitleFormat,
} from '../../helpers/subtitles/settings.ts';
import { sanitizeSubtitleFormats, sanitizeSubtitleLanguages } from '../../helpers/subtitles/sanitize.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { useToastStore } from '../../stores/toast.ts';
import { useI18n } from 'vue-i18n';
import type { SubtitleSettings } from '../../tauri/types/config.ts';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const toastStore = useToastStore();

const subtitleFormatOptions = buildSubtitleFormatOptions(t);

const subtitleSettings = ref<SubtitleSettings>(
  createSubtitleSettings(settingsStore.settings.subtitles),
);
const languageQuery = ref('');
const isSaving = ref(false);

const hasChanges = computed(() => {
  return !areSubtitleSettingsEqual(subtitleSettings.value, settingsStore.settings.subtitles);
});

const languageSelection = computed({
  get: () => subtitleSettings.value.languages,
  set: (value: string[]) => {
    subtitleSettings.value.languages = sanitizeSubtitleLanguages(value);
  },
});

const orderedFormats = computed(() =>
  sanitizeSubtitleFormats(subtitleSettings.value.formatPreference),
);

const primaryFormat = computed({
  get: () => orderedFormats.value[0] ?? getPrimarySubtitleFormat(subtitleSettings.value),
  set: (value: string) => {
    subtitleSettings.value.formatPreference = sanitizeSubtitleFormats([value]);
  },
});

const isAllSelected = computed(() => languageSelection.value.includes('all'));

function toggleAllLanguages() {
  languageSelection.value = isAllSelected.value ? [] : ['all'];
}

function toggleLanguage(code: string) {
  const next = new Set(languageSelection.value);
  if (next.has(code)) {
    next.delete(code);
  } else {
    next.add(code);
  }
  next.delete('all');
  languageSelection.value = Array.from(next);
}

function isLanguageSelected(code: string): boolean {
  return languageSelection.value.includes(code);
}

function matchesQuery(option: SubtitleLanguageOption): boolean {
  const query = languageQuery.value.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return (
    option.englishName.toLowerCase().includes(query)
    || option.nativeName.toLowerCase().includes(query)
    || option.code.toLowerCase().includes(query)
  );
}

const filteredLanguageOptions = computed(() =>
  languageOptions.filter(option => matchesQuery(option) || isLanguageSelected(option.code)),
);

const selectedLanguageBadges = computed(() => {
  if (isAllSelected.value) {
    return [];
  }

  return languageSelection.value
    .map(code => getSubtitleLanguageLabel(code))
    .filter((label, index, array) => array.indexOf(label) === index);
});

watch(
  () => settingsStore.settings.subtitles,
  (value) => {
    subtitleSettings.value = createSubtitleSettings(value);
  },
  { deep: true },
);

async function save() {
  const normalized = createSubtitleSettings(subtitleSettings.value);

  isSaving.value = true;
  try {
    await settingsStore.patch({ subtitles: normalized });
    subtitleSettings.value = normalized;
    toastStore.showToast(t('subtitles.toasts.saved'), { style: 'success' });
  } catch (error) {
    console.error(error);
    toastStore.showToast(t('subtitles.toasts.error', { error: String(error) }), {
      style: 'error',
    });
  } finally {
    isSaving.value = false;
  }
}
</script>
