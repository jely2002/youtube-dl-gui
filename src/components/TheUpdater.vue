<template>
  <div class="fixed bottom-30 right-0 z-40 pointer-events-none">
    <Transition
        appear
        enter-active-class="transition duration-250 ease-out"
        enter-from-class="translate-y-4 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-4 opacity-0"
    >
      <div
          v-if="!isIgnored && checkResult?.available"
          role="alert"
          data-testid="updater-alert"
          class="m-4 max-w-sm alert alert-horizontal alert-soft alert-info pointer-events-auto will-change-transform"
      >
        <arrow-path-icon class="w-6 h-6" :class="{ 'animate-spin': isUpdating }" />
        <template v-if="!isUpdating && !isNeedingRestart">
          <h3 class="font-bold">{{ t('updater.available') }}</h3>
          <button class="btn btn-sm" @click="updaterStore.ignore()">{{ t('common.later') }}</button>
          <button class="btn btn-info btn-sm" @click="updaterStore.download()">{{ t('common.download') }}</button>
        </template>
        <template v-else-if="isNeedingRestart">
          <div>
            <h3 class="font-bold">{{ t('updater.install.title') }}</h3>
            <p>{{ t('updater.install.subtitle') }}</p>
          </div>
          <button class="btn btn-sm" @click="updaterStore.ignore()">{{ t('common.later') }}</button>
          <button class="btn btn-info btn-sm" @click="updaterStore.install()">{{ t('common.install') }}</button>
        </template>
        <template v-else>
          <div class="w-full">
            <h3 class="font-bold">{{ t('updater.downloading') }}</h3>
            <div class="flex items-center gap-2">
              <progress class="progress progress-info w-full" :value="progress" max="100"></progress>
              <p>{{ t('common.percentage', { percent: progress.toFixed() }) }}</p>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/solid';
import { useUpdaterStore } from '../stores/updater';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const updaterStore = useUpdaterStore();
const { checkResult, downloadProgress, isIgnored, isUpdating, isNeedingRestart } = storeToRefs(updaterStore);

const progress = computed(() => {
  const received = downloadProgress.value.received ?? 0;
  const total = downloadProgress.value.total ?? 0;
  if (total === 0 && received === 0) {
    return 0;
  }
  return received / total * 100;
});
</script>
