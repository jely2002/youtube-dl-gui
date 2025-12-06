<template>
  <button :disabled="disabled" v-if="!to" :title="label" class="btn btn-xs border-none shadow-none bg-transparent disabled:bg-transparent btn-circle hover:opacity-75 transition-opacity"><span class="sr-only">{{ label }}</span><component :is="icon"/></button>
  <router-link :disabled="disabled ? true : undefined" v-else :title="label" :to="to" class="btn btn-xs border-none shadow-none bg-transparent btn-circle hover:opacity-75 transition-opacity"><span class="sr-only">{{ label }}</span><component :is="icon"/></router-link>
</template>
<script setup lang="ts">
import { type FunctionalComponent, type HTMLAttributes, PropType, type VNodeProps } from 'vue';
import { RouteLocationRaw } from 'vue-router';

const { icon, label, to } = defineProps({
  icon: {
    type: Function as PropType<FunctionalComponent<HTMLAttributes & VNodeProps>>,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  to: {
    type: Object as PropType<RouteLocationRaw>,
    required: false,
  },
  disabled: {
    type: Boolean,
    required: false,
    default: false,
  },
});
</script>

<style scoped>
.btn:disabled {
  background: transparent !important;
}
</style>
