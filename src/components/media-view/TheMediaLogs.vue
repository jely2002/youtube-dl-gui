<template>
  <section class="py-4 px-8">
    <h2 class="text-lg font-semibold mb-2">
      {{ t('media.view.logs.errors.count', { count: errors.length }) }}
    </h2>
    <ul v-if="errors.length > 0" class="flex flex-col gap-4">
      <li v-for="(error, index) in errors" :key="error.id + error.code + error.timestamp">
        <diagnostic-card :open="index === 0" :diagnostic="error"/>
      </li>
    </ul>
    <div v-else class="alert alert-success alert-soft">
      <check-circle-icon class="h-5 w-5"/>
      <span>{{ t('media.view.logs.errors.empty') }}</span>
    </div>
  </section>
  <section class="py-4 px-8">
    <h2 class="text-lg font-semibold mb-2">
      {{ t('media.view.logs.warnings.count', { count: warnings.length }) }}
    </h2>
    <ul v-if="warnings.length > 0" class="flex flex-col gap-4">
      <li v-for="warning in warnings" :key="warning.id + warning.code + warning.timestamp">
        <diagnostic-card :diagnostic="warning"/>
      </li>
    </ul>
    <div v-else class="alert alert-success alert-soft">
      <check-circle-icon class="h-5 w-5"/>
      <span>{{ t('media.view.logs.warnings.empty') }}</span>
    </div>
  </section>
  <section class="py-4 px-8">
    <h2 class="text-lg font-semibold mb-2">
      {{ t('media.view.logs.all.title') }}
    </h2>
    <div class="text-sm flex flex-col gap-2">
      <pre
          v-if="hasLog"
          role="log"
          aria-live="off"
          class="max-h-64 overflow-y-auto bg-base-300 border border-base-200 rounded-box py-3 px-4 font-mono whitespace-pre-wrap text-xs leading-6"
          v-html="linkifiedGroupLog"
      />
      <div v-else class="alert alert-info alert-soft">
        <information-circle-icon class="h-5 w-5"/>
        <span>{{ t('media.view.logs.all.empty') }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMediaDiagnosticsStore } from '../../stores/media/diagnostics.ts';
import { computed, toRefs } from 'vue';
import { CheckCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';
import DiagnosticCard from './DiagnosticCard.vue';
import { useI18n } from 'vue-i18n';
import { useGroupLog } from '../../composables/useGroupLog';
import { useLinkify } from '../../composables/useLinkify';

const { t } = useI18n();
const props = defineProps({
  groupId: {
    type: String,
    required: true,
  },
});
const { groupId } = toRefs(props);

const diagnosticsStore = useMediaDiagnosticsStore();
const groupLog = useGroupLog(groupId);
const { linkify } = useLinkify();

const linkifiedGroupLog = computed(() => {
  return linkify(groupLog.logText.value).trim();
});

const hasLog = computed(() => groupLog.logText.value.length > 0);

const errors = computed(() => {
  const diagnostics = diagnosticsStore.findDiagnosticsByGroupId(groupId.value);
  return diagnostics.filter(diagnostic => diagnostic.level === 'error');
});

const warnings = computed(() => {
  const diagnostics = diagnosticsStore.findDiagnosticsByGroupId(groupId.value);
  return diagnostics.filter(diagnostic => diagnostic.level === 'warning');
});

</script>
