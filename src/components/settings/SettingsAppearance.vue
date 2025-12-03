<template>
  <base-fieldset
      :legend="t('settings.appearance.legend')"
      :label="t('settings.appearance.legendLabel')"
  >
    <label class="font-semibold" for="theme">
      {{ t('settings.appearance.theme.label') }}
    </label>
    <select
        id="theme"
        v-model="settings.appearance.theme"
        class="select mb-2"
    >
      <option value="system">
        {{
          t('settings.appearance.theme.options.system', {
            theme: systemTheme === 'dark'
                ? t('settings.appearance.theme.options.dark')
                : t('settings.appearance.theme.options.light')
          })
        }}
      </option>
      <option value="light">{{ t('settings.appearance.theme.options.light') }}</option>
      <option value="dark">{{ t('settings.appearance.theme.options.dark') }}</option>
    </select>
    <label class="font-semibold" for="language">
      {{ t('settings.appearance.language.label') }}
    </label>
    <select
        id="language"
        v-model="settings.appearance.language"
        class="select mb-2"
    >
      <option value="system">{{ t('settings.appearance.language.options.system', { language: systemLocale }) }}</option>
      <option v-for="option in languageOptions()" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { SelectOption } from '../../helpers/forms.ts';
import { useTheme } from '../../composables/useTheme.ts';
import { availableLocales, getDefaultLocale } from '../../i18n.ts';
import { languageOptionsLookup, SubtitleLanguageOption } from '../../helpers/subtitles/languages.ts';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const { systemTheme } = useTheme();

const languageOptions = () => {
  const options: SelectOption[] = [];
  for (const locale of Object.keys(availableLocales)) {
    const language: SubtitleLanguageOption | undefined = languageOptionsLookup.get(locale);
    if (language) {
      if (language.nativeName && language.nativeName !== language.englishName) {
        options.push({
          label: `${language.englishName} - ${language.nativeName}`,
          value: language.code,
        });
      } else {
        options.push({ label: language.englishName, value: language.code });
      }
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
};

const systemLocale = computed(() => {
  const defaultLocale = getDefaultLocale();
  const language = languageOptionsLookup.get(defaultLocale);
  if (language) {
    return language.nativeName;
  }
  return defaultLocale;
});
</script>
