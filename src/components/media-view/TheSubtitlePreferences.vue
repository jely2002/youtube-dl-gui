<template>
  <form class="px-8 py-4">
    <div class="flex max-w-4xl flex-col">
      <div
        v-if="!hasAnyAvailableLanguages"
        class="alert alert-soft"
      >
        {{ t('media.preferences.subtitles.empty') }}
      </div>

      <template v-else>
        <base-fieldset
          :legend="t('media.preferences.subtitles.languages.legend')"
          :label="t('media.preferences.subtitles.languages.hint')"
        >
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <input
                id="override-all-subtitles"
                type="checkbox"
                class="toggle toggle-primary"
                :checked="isAllSelected"
                @change="toggleAllLanguages"
              />
              <label class="text-sm text-base-content/70" for="override-all-subtitles">
                {{ t('subtitles.options.languages.downloadAll') }}
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <section class="rounded-lg border border-base-300">
                <p class="border-b border-base-300 px-4 py-2 text-sm font-semibold">
                  {{ t('media.preferences.subtitles.languages.manual') }}
                </p>
                <ul v-if="availableManualLanguages.length" class="divide-y divide-base-300">
                  <li v-for="language in availableManualLanguages" :key="`manual-${language}`">
                    <label class="flex cursor-pointer items-center gap-3 px-4 py-2">
                      <input
                        :id="`manual-language-${language}`"
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        :checked="isLanguageSelected('manual', language)"
                        :disabled="isAllSelected"
                        @change="toggleLanguage('manual', language)"
                      />
                      <span>{{ languageLabel(language) }}</span>
                    </label>
                  </li>
                </ul>
                <p v-else class="px-4 py-3 text-sm text-base-content/60">
                  {{ t('media.preferences.subtitles.languages.noneManual') }}
                </p>
              </section>

              <section class="rounded-lg border border-base-300">
                <p class="border-b border-base-300 px-4 py-2 text-sm font-semibold">
                  {{ t('media.preferences.subtitles.languages.auto') }}
                </p>
                <ul v-if="availableAutoLanguages.length" class="divide-y divide-base-300">
                  <li v-for="language in availableAutoLanguages" :key="`auto-${language}`">
                    <label class="flex cursor-pointer items-center gap-3 px-4 py-2">
                      <input
                        :id="`auto-language-${language}`"
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        :checked="isLanguageSelected('auto', language)"
                        :disabled="isAllSelected"
                        @change="toggleLanguage('auto', language)"
                      />
                      <span>{{ languageLabel(language) }}</span>
                    </label>
                  </li>
                </ul>
                <p v-else class="px-4 py-3 text-sm text-base-content/60">
                  {{ t('media.preferences.subtitles.languages.noneAuto') }}
                </p>
              </section>
            </div>

            <div class="flex flex-wrap gap-2 items-center text-sm">
              <span class="font-semibold">
                {{ t('subtitles.options.languages.selected') }}
              </span>
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
      </template>

      <base-fieldset
        :legend="t('subtitles.options.format.label')"
        :badge="t('media.preferences.badges.override')"
        :label="t('subtitles.options.format.legendLabel')"
      >
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="override-embed-subtitles">
              {{ t('subtitles.options.embed.label') }}
            </label>
            <input
              id="override-embed-subtitles"
              v-model="subtitleState.embedSubtitles"
              type="checkbox"
              class="toggle toggle-primary my-1"
            />
            <p class="label">
              {{ t('subtitles.options.embed.hint') }}
            </p>
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-semibold" for="override-format-select">
              {{ t('subtitles.options.format.label') }}
            </label>
            <select
              id="override-format-select"
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
        </div>
      </base-fieldset>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseFieldset from '../base/BaseFieldset.vue';
import {
  getPreferredAutoSubtitleLanguages,
  getSubtitleLanguageLabel,
} from '../../helpers/subtitles/languages.ts';
import {
  areSubtitleSettingsEqual,
  buildSubtitleFormatOptions,
  createSubtitleSettings,
  getPrimarySubtitleFormat,
  mergeSubtitleSettings,
} from '../../helpers/subtitles/settings.ts';
import { sanitizeSubtitleFormats, sanitizeSubtitleLanguages } from '../../helpers/subtitles/sanitize.ts';
import { useMediaGroupStore } from '../../stores/media/group.ts';
import { useMediaOptionsStore } from '../../stores/media/options.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import type { SubtitleSettings } from '../../tauri/types/config.ts';
import type { DownloadOverrides, SubtitleOverrides } from '../../tauri/types/media.ts';

const props = defineProps({
  groupId: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
const groupStore = useMediaGroupStore();
const optionsStore = useMediaOptionsStore();
const settingsStore = useSettingsStore();

const subtitleFormatOptions = buildSubtitleFormatOptions(t);
const subtitleState = ref<SubtitleSettings>(createSubtitleSettings(settingsStore.settings.subtitles));
const manualLanguageSelection = ref<string[]>([]);
const autoLanguageSelection = ref<string[]>([]);
const allLanguagesSelected = ref(false);

const availableInventory = computed(() => {
  const group = groupStore.findGroupById(props.groupId);
  const manual = new Set<string>();
  const auto = new Set<string>();

  for (const item of Object.values(group?.items ?? {})) {
    item.subtitleInventory?.manualLanguages?.forEach(language => manual.add(language));
    item.subtitleInventory?.autoLanguages?.forEach(language => auto.add(language));
  }

  return {
    manual: Array.from(manual).sort(),
    auto: getPreferredAutoSubtitleLanguages(Array.from(auto)),
  };
});

const availableManualLanguages = computed(() => availableInventory.value.manual);
const availableAutoLanguages = computed(() => availableInventory.value.auto);
const hasAnyAvailableLanguages = computed(() =>
  availableManualLanguages.value.length > 0 || availableAutoLanguages.value.length > 0,
);

const orderedFormats = computed(() =>
  sanitizeSubtitleFormats(subtitleState.value.formatPreference),
);

const primaryFormat = computed({
  get: () => orderedFormats.value[0] ?? getPrimarySubtitleFormat(subtitleState.value),
  set: (value: string) => {
    subtitleState.value.formatPreference = sanitizeSubtitleFormats([value]);
  },
});

const isAllSelected = computed(() => allLanguagesSelected.value && hasAnyAvailableLanguages.value);

const selectedLanguageBadges = computed(() => {
  if (isAllSelected.value) {
    return [];
  }

  return [
    ...manualLanguageSelection.value.map(language => languageSelectionLabel('manual', language)),
    ...autoLanguageSelection.value.map(language => languageSelectionLabel('auto', language)),
  ]
    .filter((value, index, values) => values.indexOf(value) === index);
});

const resolvedSubtitleState = computed(() => {
  const globalSettings = settingsStore.settings.subtitles;
  const override = optionsStore.getOverrides(props.groupId)?.subtitles;
  return mergeSubtitleSettings(globalSettings, override);
});

function toggleAllLanguages() {
  if (isAllSelected.value) {
    allLanguagesSelected.value = false;
    manualLanguageSelection.value = [];
    autoLanguageSelection.value = [];
    return;
  }

  allLanguagesSelected.value = true;
  manualLanguageSelection.value = [...availableManualLanguages.value];
  autoLanguageSelection.value = [...availableAutoLanguages.value];
}

function toggleLanguage(source: 'manual' | 'auto', language: string) {
  allLanguagesSelected.value = false;
  const selection = source === 'manual' ? manualLanguageSelection : autoLanguageSelection;
  const next = new Set(selection.value);
  if (next.has(language)) {
    next.delete(language);
  } else {
    next.add(language);
  }
  selection.value = Array.from(next);
}

function isLanguageSelected(source: 'manual' | 'auto', language: string): boolean {
  const selection = source === 'manual' ? manualLanguageSelection : autoLanguageSelection;
  return selection.value.includes(language);
}

function languageLabel(language: string): string {
  return getSubtitleLanguageLabel(language);
}

function languageSelectionLabel(source: 'manual' | 'auto', language: string): string {
  return `${languageLabel(language)} (${t(`media.preferences.subtitles.languages.${source}`)})`;
}

function filterAvailableSelections(selected: string[], available: string[]): string[] {
  const availableSet = new Set(available);
  return sanitizeSubtitleLanguages(selected).filter(language => availableSet.has(language));
}

function resolveSourceSelections(
  settings: SubtitleSettings,
  override: SubtitleOverrides | undefined,
): { manual: string[]; auto: string[]; all: boolean } {
  const requested = sanitizeSubtitleLanguages(settings.languages);
  const wantsAll = requested.includes('all');
  const manualOverrideWantsAll = override?.manualLanguages?.includes('all') ?? false;
  const autoOverrideWantsAll = override?.autoLanguages?.includes('all') ?? false;
  const all = manualOverrideWantsAll || autoOverrideWantsAll || (!override && wantsAll);

  const manual = override?.manualLanguages
    ? (manualOverrideWantsAll
        ? [...availableManualLanguages.value]
        : filterAvailableSelections(override.manualLanguages, availableManualLanguages.value))
    : (wantsAll
        ? [...availableManualLanguages.value]
        : filterAvailableSelections(requested, availableManualLanguages.value));

  const auto = override?.autoLanguages
    ? (autoOverrideWantsAll
        ? [...availableAutoLanguages.value]
        : filterAvailableSelections(override.autoLanguages, availableAutoLanguages.value))
    : (settings.includeAutoGenerated
        ? (wantsAll
            ? [...availableAutoLanguages.value]
            : filterAvailableSelections(requested, availableAutoLanguages.value))
        : []);

  return { manual, auto, all };
}

function arraysEqual(a: string[], b: string[]): boolean {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

watch(
  [resolvedSubtitleState, availableManualLanguages, availableAutoLanguages],
  ([value]) => {
    if (!areSubtitleSettingsEqual(subtitleState.value, value)) {
      subtitleState.value = value;
    }

    const override = optionsStore.getOverrides(props.groupId)?.subtitles;
    const nextSelections = resolveSourceSelections(value, override);
    allLanguagesSelected.value = nextSelections.all;
    if (!arraysEqual(manualLanguageSelection.value, nextSelections.manual)) {
      manualLanguageSelection.value = nextSelections.manual;
    }
    if (!arraysEqual(autoLanguageSelection.value, nextSelections.auto)) {
      autoLanguageSelection.value = nextSelections.auto;
    }
  },
  { deep: true, immediate: true },
);

watch(
  [subtitleState, manualLanguageSelection, autoLanguageSelection, allLanguagesSelected],
  () => {
    const currentLanguages = sanitizeSubtitleLanguages([
      ...manualLanguageSelection.value,
      ...autoLanguageSelection.value,
    ]);
    const current = createSubtitleSettings({
      ...subtitleState.value,
      enabled: currentLanguages.length > 0,
      includeAutoGenerated: autoLanguageSelection.value.length > 0,
      languages: currentLanguages,
    });
    const base = createSubtitleSettings(settingsStore.settings.subtitles);
    const baseSelections = resolveSourceSelections(base, undefined);
    const subtitleOverride: SubtitleOverrides = {};
    if (current.enabled !== base.enabled) subtitleOverride.enabled = current.enabled;
    if (current.includeAutoGenerated !== base.includeAutoGenerated) {
      subtitleOverride.includeAutoGenerated = current.includeAutoGenerated;
    }
    if (current.embedSubtitles !== base.embedSubtitles) {
      subtitleOverride.embedSubtitles = current.embedSubtitles;
    }
    if (JSON.stringify(current.languages) !== JSON.stringify(base.languages)) {
      subtitleOverride.languages = current.languages;
    }
    if (JSON.stringify(current.formatPreference) !== JSON.stringify(base.formatPreference)) {
      subtitleOverride.formatPreference = current.formatPreference;
    }
    if (allLanguagesSelected.value) {
      subtitleOverride.manualLanguages = ['all'];
      subtitleOverride.autoLanguages = ['all'];
    } else {
      if (!arraysEqual(manualLanguageSelection.value, baseSelections.manual)) {
        subtitleOverride.manualLanguages = [...manualLanguageSelection.value];
      }
      if (!arraysEqual(autoLanguageSelection.value, baseSelections.auto)) {
        subtitleOverride.autoLanguages = [...autoLanguageSelection.value];
      }
    }
    if (allLanguagesSelected.value) {
      subtitleOverride.languages = ['all'];
    }
    const existing = optionsStore.getOverrides(props.groupId);
    const next: DownloadOverrides = { ...(existing ?? {}) };

    if (Object.keys(subtitleOverride).length > 0) {
      next.subtitles = subtitleOverride;
    } else {
      delete next.subtitles;
    }

    if (Object.values(next).some(value => value !== undefined)) {
      optionsStore.setOverrides(props.groupId, next);
    } else {
      optionsStore.removeOverrides(props.groupId);
    }
  },
  { deep: true },
);
</script>
