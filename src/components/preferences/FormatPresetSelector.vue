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

    <div class="flex flex-col mb-4">
      <label class="font-semibold mb-2" :for="`${idPrefix}-restrictFilenames`">
        {{ restrictFilenamesLabel }}
      </label>
      <input
          :id="`${idPrefix}-restrictFilenames`"
          type="checkbox"
          v-model="internalRestrictFilenames"
          class="toggle toggle-primary"
      />
      <span class="label mt-2">{{ restrictFilenamesHint }}</span>
    </div>

    <p v-if="displayExample" class="font-semibold mb-2">
      {{ exampleLabel }}
    </p>
    <p v-if="displayExample" class="text-[14px] mb-2">
      {{ fullExample }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FormatPreset } from '../../tauri/types/config.ts';
import { usePreferencesStore } from '../../stores/preferences';
import { TrackType } from '../../tauri/types/media';

interface PresetDef {
  label: string;
  value: FormatPreset;
  format: string;
  example?: string;
}

const preferencesStore = usePreferencesStore();

const props = defineProps<{
  idPrefix: string;
  presets: PresetDef[];
  modelValue: string;
  preset: FormatPreset;
  trackType: TrackType;
  presetLabel: string;
  formatLabel: string;
  exampleLabel: string;
  restrictFilenames: boolean;
  restrictFilenamesLabel: string;
  restrictFilenamesHint: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [string];
  'update:preset': [FormatPreset];
  'update:restrictFilenames': [boolean];
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

const internalRestrictFilenames = computed<boolean>({
  get: () => props.restrictFilenames,
  set(val) {
    emit('update:restrictFilenames', val);
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

const displayExample = computed<string | undefined>(() => {
  let base = example.value;
  if (!base) {
    preferencesStore.setFilenameExample(props.trackType, '');
    return undefined;
  }
  if (props.restrictFilenames) {
    base = base.replace(/\s+/g, '_').replace(/&/g, '_and_');
  }
  preferencesStore.setFilenameExample(props.trackType, base);
  return base;
});

const fullExample = computed<string>(() => {
  return preferencesStore.getPathExample(props.trackType);
});
</script>
