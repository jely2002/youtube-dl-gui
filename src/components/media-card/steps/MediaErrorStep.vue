<template>
  <div class="card-body py-0 pr-0 grow w-full min-w-0">
    <h2 :title="group.title ?? group.url" class="card-title w-full block leading-8 overflow-hidden text-nowrap text-ellipsis text-base">{{ group.title ?? group.url }}</h2>
    <base-progress
        :id="`${group.id}-progress`"
        :max="100"
        :value="100"
        :style="ProgressStyle.error"
    >
      {{ t('media.steps.error.errorPrefix', { message: diagnosticDisplay.shortMessage }) }}
    </base-progress>
    <p>{{ diagnosticDisplay.message }}</p>
    <div class="w-full flex gap-4">
      <button @click="report" v-if="isReportable" :disabled="hasReported"  class="btn btn-subtle">
        <template v-if="isReporting">
          <span class="sr-only">{{ t('common.loading') }}</span>
          <span class="loading loading-spinner loading-sm"></span>
        </template>
        <template v-else>
          <span>{{ t('media.steps.error.report') }}</span>
        </template>
      </button>
      <router-link :to="{ name: 'group.logs', params: { groupId: group.id } }" class="btn btn-subtle">{{ t('media.steps.error.showFull') }}</router-link>
      <router-link v-if="signInRequired" :to="{ name: 'authentication' }" class="btn btn-subtle">{{ t('media.steps.error.signIn') }}</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import BaseProgress from '../../base/BaseProgress.vue';
import { Group } from '../../../tauri/types/group';
import { useI18n } from 'vue-i18n';
import { useMediaDiagnosticsStore } from '../../../stores/media/diagnostics.ts';
import { useDiagnostic } from '../../../composables/useDiagnostic.ts';
import { ProgressStyle } from '../../../tauri/types/progress.ts';

const i18n = useI18n();
const t = i18n.t;

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const diagnosticsStore = useMediaDiagnosticsStore();

const lastFatal = computed(() => diagnosticsStore.findLastFatalByGroupId(group.id));
const lastDiagnostic = computed(() => diagnosticsStore.findLastDiagnosticByGroupId(group.id));

const error = computed(() => {
  let diagnostic: MediaDiagnostic = {
    id: 'unknown',
    code: 'unknown',
    groupId: group.id,
    raw: 'unknown',
    message: 'unknown',
    level: 'error',
    component: null,
    timestamp: 0,
  };

  if (!lastFatal.value && !lastDiagnostic.value) {
    return diagnostic;
  } else if (lastFatal.value) {
    if (lastFatal.value.internal) {
      diagnostic.id = lastFatal.value.id;
      diagnostic.message = lastFatal.value.message;
      diagnostic.code = 'unknown';
      diagnostic.component = 'runner';
      diagnostic.raw = lastFatal.value.details ?? 'unknown';
      diagnostic.level = 'error';
      diagnostic.timestamp = lastFatal.value.timestamp;
    } else if (lastDiagnostic.value) {
      diagnostic = lastDiagnostic.value;
    }
  }

  return diagnostic;
});

const { diagnosticDisplay, report, isReportable, isReporting, hasReported } = useDiagnostic(error, true);
const signInRequired = computed(() => error.value.code.includes('signIn'));

</script>
