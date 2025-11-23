<template>
  <base-fieldset
      :legend="t('settings.filename.legend')"
      :label="t('settings.filename.legendLabel')"
  >
    <label class="font-semibold" for="formatPreset">
      {{ t('settings.filename.formatPreset.label') }}
    </label>
    <select
        id="formatPreset"
        v-model="selectedFormatPreset"
        class="select mb-2"
    >
      <option
          v-for="preset in outputFormatPresets"
          :key="preset.value"
          :value="preset.value"
      >
        {{ preset.label }}
      </option>
    </select>
    <label class="font-semibold" for="outputFormat">
      {{ t('settings.filename.outputFormat.label') }}
    </label>
    <input
        v-model="outputFormatValue"
        :disabled="!isCustom"
        type="text"
        id="outputFormat"
        class="input w-full"
    />
  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';
import { computed, onMounted, ref, watch } from 'vue';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

enum FormatPreset {
  TitleQuality = 'titleQuality',
  TitleOnly = 'titleOnly',
  Custom = 'custom',
}

const selectedFormatPreset = ref<FormatPreset>(FormatPreset.Custom);

const outputFormatPresets = [
  {
    label: t('settings.filename.formatPreset.options.titleQuality'),
    value: FormatPreset.TitleQuality,
    format: '%(title).200s-(%(height)sp%(fps).0d).%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.titleOnly'),
    value: FormatPreset.TitleOnly,
    format: '%(title).200s.%(ext)s',
  },
  {
    label: t('settings.filename.formatPreset.options.custom'),
    value: FormatPreset.Custom,
    format: '',
  },
];

const isCustom = computed(() => selectedFormatPreset.value === FormatPreset.Custom);

onMounted(() => {
  const match = outputFormatPresets.find(
    p => p.value !== FormatPreset.Custom && settings.value.output.fileNameTemplate === p.format,
  );
  selectedFormatPreset.value = match?.value as FormatPreset ?? FormatPreset.Custom;
});

watch(selectedFormatPreset, (newVal) => {
  if (newVal !== FormatPreset.Custom) {}
  const preset = outputFormatPresets.find(p => p.value === newVal);
  if (preset) {
    settings.value.output.fileNameTemplate = preset.format;
  }
});

const outputFormatValue = computed<string>({
  get() {
    if (!isCustom.value) {
      return (
        outputFormatPresets.find(p => p.value === selectedFormatPreset.value)?.format
        ?? settings.value.output.fileNameTemplate ?? outputFormatPresets[0].format
      );
    }
    return settings.value.output.fileNameTemplate ?? outputFormatPresets[0].format;
  },
  set(val: string) {
    settings.value.output.fileNameTemplate = val;
  },
});
</script>
