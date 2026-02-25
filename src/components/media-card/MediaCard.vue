<template>
  <article class="card card-side p-4 w-175 max-h-44 bg-base-300 shadow-md" :class="[statusOutline]">
    <figure class="shrink-0 w-64 aspect-video rounded-md overflow-hidden bg-base-100">
      <img
          :src="group.thumbnail ?? placeholderUrl"
          :alt="t('media.view.thumbnailAlt', { title: group.title ?? '' })"
          class="object-cover w-full h-full"
          @error="setPlaceholderImage"
      />
    </figure>
    <component
        :is="activeStep"
        v-if="activeStep"
        v-bind="activeStepProps"
    />
    <div class="divider divider-horizontal"></div>
    <media-card-actions
        @download="downloadGroup"
        @retry="retryGroup"
        @remove="removeGroup"
        @pause="pauseGroup"
        @resume="downloadGroup"
        :group="group"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, ComputedRef, PropType } from 'vue';
import placeholderUrl from '../../assets/placeholder.png';
import { MediaState, useMediaStateStore } from '../../stores/media/state';
import { useMediaStore } from '../../stores/media/media';
import { useMediaOptionsStore } from '../../stores/media/options';
import FetchStep from './steps/FetchStep.vue';
import FetchListStep from './steps/FetchListStep.vue';
import MediaConfigureStep from './steps/MediaConfigureStep.vue';
import MediaDownloadStep from './steps/MediaDownloadStep.vue';
import MediaDoneStep from './steps/MediaDoneStep.vue';
import MediaErrorStep from './steps/MediaErrorStep.vue';
import MediaCardActions from './actions/MediaCardActions.vue';
import MediaDownloadListStep from './steps/MediaDownloadListStep.vue';
import { useToastStore } from '../../stores/toast';
import { Group } from '../../tauri/types/group';
import { useI18n } from 'vue-i18n';
import MediaPausedStep from './steps/MediaPausedStep.vue';
import MediaPausedListStep from './steps/MediaPausedListStep.vue';

const stepMap = {
  [MediaState.fetching]: FetchStep,
  [MediaState.fetchingList]: FetchListStep,
  [MediaState.configure]: MediaConfigureStep,
  [MediaState.downloading]: MediaDownloadStep,
  [MediaState.downloadingList]: MediaDownloadListStep,
  [MediaState.paused]: MediaPausedStep,
  [MediaState.pausedList]: MediaPausedListStep,
  [MediaState.done]: MediaDoneStep,
  [MediaState.error]: MediaErrorStep,
} as const;

const stateStore = useMediaStateStore();
const mediaStore = useMediaStore();
const toastStore = useToastStore();
const optionsStore = useMediaOptionsStore();

const { t } = useI18n();

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const groupState: ComputedRef<MediaState | undefined> = computed(() => stateStore.getGroupState(group.id));

const activeStep = computed(() => stepMap[groupState.value ?? MediaState.fetching]);

const activeStepProps = computed(() => ({ group }));

const downloadGroup = (): void => {
  const options = optionsStore.getOptions(group.id);
  if (!options) {
    // TODO show a toast?
    console.warn(`No options found for group: ${group.id}, cannot download.`);
    return;
  }
  void mediaStore.downloadGroup(group.id, options);
};

const pauseGroup = (): void => {
  void mediaStore.pauseGroup(group.id);
};

const retryGroup = (): void => {
  if (!group.url) {
    toastStore.showToast(t('media.card.toasts.retryError'), { style: 'error' });
    return;
  }
  mediaStore.dispatchMediaInfoFetch(group.url, false, group.urlHeaders)
    .then(() => {
      toastStore.showToast(t('media.card.toasts.retry'));
    })
    .catch(() => {
      toastStore.showToast(t('media.card.toasts.retryError'), { style: 'error' });
    });
};

const removeGroup = (): void => {
  mediaStore.deleteGroup(group?.id);
};

const setPlaceholderImage = (event: Event): void => {
  if (event.target instanceof HTMLImageElement) {
    event.target.src = placeholderUrl;
  }
};

const statusOutline = computed(() => {
  switch (groupState.value) {
    case MediaState.error:
      return 'border border-error';
    case MediaState.paused:
    case MediaState.pausedList:
      return 'border border-warning';
    default:
      return '';
  }
});

</script>
