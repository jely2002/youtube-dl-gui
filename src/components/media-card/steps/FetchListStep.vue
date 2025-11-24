<template>
  <div class="card-body py-0 pr-0 grow w-full min-w-0">
    <h2 :title="group.title ?? group.url" class="card-title block leading-8 overflow-hidden text-nowrap text-ellipsis text-base">{{
        group.title ?? group.url
      }}</h2>
    <base-progress
        :id="`${group.id}-progress`"
        :max="group?.total"
        :value="group?.processed"
    >
      {{ t('media.steps.fetch.progress', { percentage, done: group?.processed ?? '0', total: group?.total ?? '1' }) }}
    </base-progress>
    <p>{{ t('media.steps.fetch.progressLabel') }}</p>
  </div>
</template>

<script setup lang="ts">

import { computed, PropType } from 'vue';
import BaseProgress from '../../base/BaseProgress.vue';
import { Group } from '../../../tauri/types/group';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const percentage = computed((): string => {
  const rawPercentage = group.processed / group.total * 100;
  return rawPercentage.toFixed(2);
});

</script>
