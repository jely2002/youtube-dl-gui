<template>
  <div class="card-body py-0 pr-0 grow w-full min-w-0">
    <h2 :title="group.url" class="card-title block leading-8 overflow-hidden text-nowrap text-ellipsis text-base">{{
        group.url
      }}</h2>
    <base-progress
        :id="`${group.id}-progress`"
    >
      <p>{{ t('media.steps.fetch.progressLabel') }}</p>
    </base-progress>
  </div>
</template>

<script setup lang="ts">

import { PropType } from 'vue';
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

</script>
