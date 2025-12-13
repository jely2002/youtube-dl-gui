<template>
  <div class="flex flex-col">
    <label class="font-semibold mb-2" :for="`${idPrefix}-preset`">
      {{ presetLabel }}
    </label>
    <select
        :id="`${idPrefix}-preset`"
        v-model="internalPreset"
        class="select mb-4"
    >
      <option
          v-for="preset in presets"
          :key="preset.value"
          :value="preset.value"
      >
        {{ preset.label }}
      </option>
    </select>

    <label class="font-semibold mb-2" :for="`${idPrefix}-format`">
      {{ formatLabel }}
    </label>
    <input
        :id="`${idPrefix}-format`"
        type="text"
        class="input w-full mb-4"
        :disabled="!isCustom"
        v-model="internalTemplate"
    />

    <p v-if="example" class="font-semibold mb-2">
      {{ exampleLabel }}
    </p>
    <p v-if="example" class="text-[14px] mb-2">
      {{ example }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FormatPreset } from '../../tauri/types/config.ts';

interface PresetDef {
  label: string;
  value: FormatPreset;
  format: string;
  example?: string;
}

const props = defineProps<{
  idPrefix: string;
  presets: PresetDef[];
  modelValue: string;
  preset: FormatPreset;
  presetLabel: string;
  formatLabel: string;
  exampleLabel: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [string];
  'update:preset': [FormatPreset];
}>();

const isCustom = computed(() => props.preset === FormatPreset.Custom);

const internalPreset = computed<FormatPreset>({
  get: () => props.preset,
  set(val) {
    emit('update:preset', val);

    if (val !== FormatPreset.Custom) {
      const preset = props.presets.find(p => p.value === val);
      if (preset) {
        emit('update:modelValue', preset.format);
      }
    }
  },
});

const internalTemplate = computed<string>({
  get() {
    if (!isCustom.value) {
      return (
        props.presets.find(p => p.value === props.preset)?.format
        ?? props.modelValue
        ?? props.presets[0]?.format
        ?? ''
      );
    }
    return props.modelValue ?? props.presets[0]?.format ?? '';
  },
  set(val: string) {
    emit('update:modelValue', val);
  },
});

const example = computed<string | undefined>(() => {
  if (isCustom.value) return undefined;
  return (
    props.presets.find(p => p.value === props.preset)?.example
    ?? props.modelValue
    ?? props.presets[0]?.example
  );
});
</script>
