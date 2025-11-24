<template>
  <div class="card-body py-0 pr-0 grow w-full overflow-hidden">
    <h2
        :title="group.title ?? group.url"
        class="card-title block leading-8 overflow-hidden whitespace-nowrap overflow-ellipsis text-base"
    >
      {{ group.title ?? group.url }}
    </h2>

    <base-progress
        v-if="isIndeterminate"
        :id="`${group.id}-progress`"
    >
      {{ t('media.steps.download.indeterminate', { status: indeterminateDisplay }) }}
    </base-progress>
    <base-progress
        v-else
        :id="`${group.id}-progress`"
        :max="100"
        :value="percent"
    >
      {{
        capitalizeFirstLetter(t('media.steps.download.progress', {
            category: categoryDisplay,
            percentage: percent.toFixed(2),
        }))
      }}
    </base-progress>

    <div v-if="!isIndeterminate" class="w-full flex gap-4">
      <p>
        {{ t('media.steps.download.metadata.eta', { eta: etaDisplay }) }}
      </p>
      <p>
        {{ t('media.steps.download.metadata.speed', { speed: speedDisplay }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref, watch } from 'vue';
import { useMediaProgressStore } from '../../../stores/media/progress';
import BaseProgress from '../../base/BaseProgress.vue';
import { capitalizeFirstLetter } from '../../../helpers/progress';
import { formatBytesPerSec, formatDuration } from '../../../helpers/units';
import { ProgressCategory, ProgressStage } from '../../../tauri/types/progress';
import { Group } from '../../../tauri/types/group';
import { useI18n } from 'vue-i18n';

const i18n = useI18n();
const t = i18n.t;

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const store = useMediaProgressStore();
const progress = computed(() => store.findDownloadProgress(group.id));

const isIndeterminate = computed(() => {
  if (!progress.value) return true;
  return progress.value.stage !== ProgressStage.downloading;
});

const statusLocalization: Record<string, string> = i18n.tm('media.steps.download.status');
const indeterminateDisplay = computed(() => {
  let stage = ProgressStage.initializing as ProgressStage;
  if (progress.value?.stage) {
    stage = progress.value.stage;
  }
  return statusLocalization[stage] ?? capitalizeFirstLetter(stage);
});

const categoryLocalization: Record<string, string> = i18n.tm('media.steps.download.category');
const categoryDisplay = computed(() => {
  const category: string = (progress.value?.category ?? ProgressCategory.other).toLowerCase();
  return categoryLocalization[category] ?? category;
});

const percent = computed(() =>
  progress.value?.percentage ?? 0,
);

const speedDisplay = computed(() =>
  progress.value?.speedBps != null
    ? formatBytesPerSec(progress.value.speedBps)
    : '-',
);

const rawEta = computed(() => progress.value?.etaSecs ?? 0);
const displayEta = ref(rawEta.value);

const alpha = 0.2;

watch(rawEta, (newEta) => {
  displayEta.value = Math.round(
    displayEta.value * (1 - alpha) + newEta * alpha,
  );
});

const etaDisplay = computed(() =>
  progress.value?.etaSecs != null ? formatDuration(progress.value.etaSecs) : '-',
);
</script>
