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
import { DirectoryPreset } from '../../tauri/types/config.ts';
import { usePreferencesStore } from '../../stores/preferences';
import { TrackType } from '../../tauri/types/media';

interface PresetDef {
  label: string;
  value: DirectoryPreset;
  format: string;
  example?: string;
}

const preferencesStore = usePreferencesStore();

const props = defineProps<{
  idPrefix: string;
  presets: PresetDef[];
  modelValue: string;
  preset: DirectoryPreset;
  trackType: TrackType;
  presetLabel: string;
  formatLabel: string;
  exampleLabel: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [string];
  'update:preset': [DirectoryPreset];
}>();

const isCustom = computed(() => props.preset === DirectoryPreset.Custom);

const internalPreset = computed<DirectoryPreset>({
  get: () => props.preset,
  set(val) {
    emit('update:preset', val);

    if (val !== DirectoryPreset.Custom) {
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

const displayExample = computed<string | undefined>(() => {
  const base = example.value;
  if (!base) {
    preferencesStore.setPathExample(props.trackType, '');
    return undefined;
  }
  preferencesStore.setPathExample(props.trackType, base);
  return base;
});

const fullExample = computed<string>(() => {
  return preferencesStore.getPathExample(props.trackType);
});
</script>
