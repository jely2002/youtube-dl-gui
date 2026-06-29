<template>
  <div class="card-body py-0 pr-0 grow w-full min-w-0">
    <h2 :title="group.title ?? group.url" class="card-title w-full block leading-8 overflow-hidden text-nowrap text-ellipsis text-base">{{ group.title ?? group.url }}</h2>
    <base-progress
        :id="`${group.id}-progress`"
        :max="100"
        :value="100"
    >
      {{ t('media.steps.done.complete') }}
    </base-progress>
    <p v-if="singleSkippedReason" class="text-sm">
      {{ singleSkippedReason }}
    </p>
    <p v-else-if="itemOutcomeDisplay" class="text-sm">
      {{ t('media.steps.configure.metadata.items', { amount: group.total, details: itemOutcomeDisplay }) }}
    </p>
    <div class="w-full flex gap-4">
      <div
          class="tooltip-bottom"
          :class="{ 'tooltip before:p-3': !groupDestination }"
          :data-tip="t('media.steps.done.undeterminedLocation')"
      >
        <button :disabled="!groupDestination" @click="revealFile" class="btn btn-primary">
          {{ t('media.steps.done.showFolder') }}
        </button>
      </div>
      <div
          class="tooltip-bottom"
          :class="{ 'tooltip before:p-3': !groupDestination }"
          :data-tip="t('media.steps.done.undeterminedLocation')"
      >
        <button :disabled="!groupDestination" @click="openFile" class="btn btn-primary">
          {{ group.isCombined ? t('media.steps.done.openFirst') : t('media.steps.done.open') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, PropType } from 'vue';
import BaseProgress from '../../base/BaseProgress.vue';
import { useOpener } from '../../../composables/useOpener';
import { useMediaDestinationStore } from '../../../stores/media/destination';
import { Group } from '../../../tauri/types/group';
import { useI18n } from 'vue-i18n';
import { countSkippedDiagnostics, groupSkippedDiagnostics } from '../../../helpers/skippedDiagnostics.ts';
import { useMediaDiagnosticsStore } from '../../../stores/media/diagnostics.ts';

const { t } = useI18n();
const { openPath, revealPath } = useOpener();
const destinationStore = useMediaDestinationStore();
const diagnosticsStore = useMediaDiagnosticsStore();

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const groupDestination = computed(() => {
  const destination = destinationStore.getPrimaryDestination(group.id);
  return destination?.path;
});

const skippedCount = computed(() => countSkippedDiagnostics(diagnosticsStore.findDiagnosticsByGroupId(group.id)));
const skippedGroups = computed(() => groupSkippedDiagnostics(diagnosticsStore.findDiagnosticsByGroupId(group.id)));

const singleSkippedReason = computed(() => {
  if (group.isCombined || group.errored > 0 || skippedGroups.value.length === 0) {
    return '';
  }

  return skippedGroups.value[0]?.message ?? '';
});

const itemOutcomeDisplay = computed(() => {
  if (group.errored > 0 && skippedCount.value > 0) {
    return t('media.steps.configure.metadata.failedAndSkippedCount', {
      failed: group.errored,
      skipped: skippedCount.value,
    });
  }

  if (group.errored > 0) {
    return t('media.steps.configure.metadata.failedCount', { amount: group.errored });
  }

  if (skippedCount.value > 0) {
    return t('media.steps.configure.metadata.skippedCount', { amount: skippedCount.value });
  }

  return '';
});

const openFile = async () => {
  const destination = groupDestination.value;
  if (!destination) return;
  await openPath(destination);
};

const revealFile = async () => {
  const destination = groupDestination.value;
  if (!destination) return;
  await revealPath(destination);
};

</script>
