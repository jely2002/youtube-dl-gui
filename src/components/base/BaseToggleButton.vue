<template>
  <base-button :loading="loading"  :tooltip="tooltip" :tooltip-location="tooltipLocation">
    <div class="swap" :class="{ 'swap-active': model }">
      <div class="swap-on">
        <slot name="on"/>
      </div>
      <div class="swap-off" :class="{ 'swap-active': !model }">
        <slot name="off"/>
      </div>
    </div>
  </base-button>
</template>

<script setup lang="ts">

import BaseButton from './BaseButton.vue';

const model = defineModel({ type: Boolean, required: false, default: false });

const { loading, tooltip, tooltipLocation } = defineProps({
  loading: {
    type: Boolean,
    required: false,
  },
  tooltip: {
    type: String,
    required: false,
  },
  tooltipLocation: {
    type: String,
    required: false,
    default: 'top',
  },
});
</script>
