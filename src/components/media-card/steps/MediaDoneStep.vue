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
      <button
          v-if="isAudioGroup"
          :disabled="!groupDestination || audioQualityStore.isLoading(group.id)"
          @click="checkAudioQuality"
          class="btn btn-subtle"
      >
        <template v-if="audioQualityStore.isLoading(group.id)">
          <span class="sr-only">{{ t('common.loading') }}</span>
          <span class="loading loading-spinner loading-sm"></span>
        </template>
        <template v-else>
          {{ t('media.steps.done.audioQuality.check') }}
        </template>
      </button>
    </div>
    <div v-if="isAudioGroup && (qualityResult || qualityError)" class="w-full flex flex-col gap-1">
      <span v-if="qualityResult" class="badge badge-soft w-fit" :class="qualityBadgeClass">
        {{ t('media.steps.done.audioQuality.score', { score: qualityResult.score }) }}
      </span>
      <ul v-if="qualityResult?.issues.length" class="text-sm list-disc list-inside opacity-70">
        <li v-for="issue in qualityResult.issues" :key="issue">{{ issue }}</li>
      </ul>
      <span v-else-if="qualityError" class="badge badge-soft badge-error w-fit">
        {{ t('media.steps.done.audioQuality.error') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, PropType } from 'vue';
import BaseProgress from '../../base/BaseProgress.vue';
import { useOpener } from '../../../composables/useOpener';
import { useMediaDestinationStore } from '../../../stores/media/destination';
import { useMediaOptionsStore } from '../../../stores/media/options';
import { useMediaAudioQualityStore } from '../../../stores/media/audioQuality';
import { Group } from '../../../tauri/types/group';
import { TrackType } from '../../../tauri/types/media';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { openPath, revealPath } = useOpener();
const destinationStore = useMediaDestinationStore();
const optionsStore = useMediaOptionsStore();
const audioQualityStore = useMediaAudioQualityStore();

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

const isAudioGroup = computed(() => optionsStore.getOptions(group.id)?.trackType === TrackType.audio);

const qualityResult = computed(() => audioQualityStore.getResult(group.id));
const qualityError = computed(() => audioQualityStore.getError(group.id));

const qualityBadgeClass = computed(() => {
  const score = qualityResult.value?.score ?? 0;
  if (score >= 80) return 'badge-success';
  if (score >= 60) return 'badge-warning';
  return 'badge-error';
});

const checkAudioQuality = async () => {
  const destination = groupDestination.value;
  if (!destination) return;
  await audioQualityStore.checkQuality(group.id, destination);
};

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
