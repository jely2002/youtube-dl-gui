<template>
  <div class="card-body py-0 pr-0 grow w-full overflow-hidden">
    <h2
        :title="group.title ?? group.url"
        class="card-title block leading-8 overflow-hidden whitespace-nowrap overflow-ellipsis text-base"
    >
      {{ group.title ?? group.url }}
    </h2>

    <base-progress
        :id="`${group.id}-progress`"
        :max="100"
        :value="percent"
        :style="ProgressStyle.warning"
    >
      {{
        t('media.steps.paused.progressList', {
          percentage: percent.toFixed(2),
          done: progress?.done ?? 0,
          total: progress?.total ?? 0,
        })
      }}
    </base-progress>

    <div class="w-full flex gap-4">
      <p>
        {{ t('media.steps.paused.metadata.etaItems', { n: remainingItems }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import { useMediaProgressStore } from '../../../stores/media/progress';
import BaseProgress from '../../base/BaseProgress.vue';
import { computeGroupPercentage } from '../../../helpers/progress';
import { Group } from '../../../tauri/types/group';
import { useI18n } from 'vue-i18n';
import { ProgressStyle } from '../../../tauri/types/progress.ts';

const { t } = useI18n();
const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const store = useMediaProgressStore();
const progress = computed(() => store.findGroupProgress(group.id));

const percent = computed(() => {
  return computeGroupPercentage(progress.value);
});

const remainingItems = computed(() => {
  return Math.min(1, (progress.value?.total ?? 0) - (progress.value?.done ?? 0));
});
</script>
