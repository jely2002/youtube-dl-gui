<template>
  <div class="flex flex-col items-center gap-4 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 absolute">
      <ArrowUpIcon class="w-36"/>

      <p class="text-3xl font-bold text-center">
        {{ t('components.base.emptyState.title') }}
      </p>

      <p class="text-md font-semibold text-center">
        {{ t('components.base.emptyState.subtitle') }}
      </p>
  </div>
</template>

<script setup lang="ts">
import { ArrowUpIcon } from '@heroicons/vue/24/solid';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
