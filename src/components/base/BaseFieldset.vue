<template>
  <fieldset class="fieldset relative mb-4">
    <legend
      class="fieldset-legend absolute top-0 left-0 text-lg"
    >
      {{ legend }}
      <div v-if="badge" class="badge badge-soft badge-info">{{ badge }}</div>
    </legend>
    <p class="label mt-8 mb-2">{{ label }}</p>
    <slot/>
  </fieldset>
</template>

<script setup lang="ts">

const { label, legend } = defineProps({
  label: {
    type: String,
    required: true,
  },
  legend: {
    type: String,
    required: true,
  },
  badge: {
    type: String,
    required: false,
  },
});

</script>
