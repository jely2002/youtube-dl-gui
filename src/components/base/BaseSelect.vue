<template>
  <div class="flex flex-col gap-2">
    <label class="font-semibold" :for="id">
      {{ label }}
    </label>
    <select
        :id="id"
        v-model="value"
        class="select"
    >
      <option
          v-for="option in selectOptions"
          :key="option.value"
          :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="hint" class="label text-balance">{{ hint }}</p>
  </div>
</template>
<script setup lang="ts">
import { computed, PropType, useId } from 'vue';
import { SelectOption } from '../../helpers/forms.ts';
import { useI18n } from 'vue-i18n';

const i18n = useI18n();

const id = useId() + '-select';

const value = defineModel<string | number>({ required: true });
const { label, options, localeKey, hint } = defineProps({
  label: {
    type: String,
    required: true,
  },
  options: {
    type: Object as PropType<Record<string, string>>,
    required: true,
  },
  localeKey: {
    type: String,
    required: true,
  },
  hint: {
    type: String,
    required: false,
  },
});

const selectOptions = computed<SelectOption[]>(() => {
  const i18nLabels = i18n.tm(localeKey);
  return Object.entries(options).map(([label, value]) => ({
    value,
    label: i18nLabels[label] as string,
  }));
});

</script>
