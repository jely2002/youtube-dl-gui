<template>
  <nav class="flex w-full items-center justify-between p-4 sticky top-0 bg-base-200 z-10 shadow-lg">
    <router-link v-if="backButton" to="/" class="btn btn-soft">
      <chevron-left-icon class="w-4 h-4"/>
      {{ t('common.back') }}
    </router-link>
    <slot name="title"/>
    <div class="flex gap-4">
      <slot/>
    </div>
  </nav>
</template>
<script setup lang="ts">
import { ChevronLeftIcon } from '@heroicons/vue/24/solid';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { backButton } = defineProps({
  backButton: {
    type: Boolean,
    required: false,
    default: true,
  },
});
</script>
