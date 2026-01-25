<template>
  <aside class="flex flex-col h-full justify-between gap-2">
    <media-card-action-item
        @click="removeItem"
        :label="t('media.card.actions.remove')"
        :icon="XCircleIcon"
    />
    <media-card-action-item
        @click="openExternalUrl"
        :disabled="!isValidExternalUrl"
        :label="t('media.card.actions.externalUrl')"
        :icon="ArrowTopRightOnSquareIcon"
    />
    <media-card-action-item
        v-if="canRetry"
        @click="retryItem"
        :label="t('media.card.actions.retry')"
        :icon="ArrowPathIcon"
    />
    <media-card-action-item
       v-else-if="canPause"
       @click="pauseItem"
       :label="t('media.card.actions.pause')"
       :icon="PauseIcon"
    />
    <media-card-action-item
        v-else-if="canResume"
        @click="resumeItem"
        :label="t('media.card.actions.resume')"
        :icon="PlayIcon"
    />
    <media-card-action-item
        v-else
        @click="downloadItem"
        :disabled="!canDownload"
        :label="t('media.card.actions.download')"
        :icon="ArrowDownTrayIcon"
    />
    <media-card-action-item
        :disabled="!canViewInfo"
        :to="{ name: 'group.metadata', params: { groupId: group.id } }"
        :label="t('media.card.actions.metadata')"
        :icon="InformationCircleIcon"
    />
  </aside>
</template>
<script setup lang="ts">
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  InformationCircleIcon,
  XCircleIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/vue/24/solid';
import MediaCardActionItem from './MediaCardActionItem.vue';
import { computed, PropType } from 'vue';
import { useOpener } from '../../../composables/useOpener';
import { MediaState, useMediaStateStore } from '../../../stores/media/state';
import { Group } from '../../../tauri/types/group';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { openUrl } = useOpener();

const emit = defineEmits<{
  (e: 'download'): void;
  (e: 'pause'): void;
  (e: 'resume'): void;
  (e: 'remove'): void;
  (e: 'retry'): void;
}>();

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const stateStore = useMediaStateStore();
const groupState = computed(() => stateStore.getGroupState(group.id));

const canDownload = computed(() => groupState.value === MediaState.configure);
const canPause = computed(() => groupState.value === MediaState.downloading || groupState.value === MediaState.downloadingList);
const canResume = computed(() => groupState.value === MediaState.paused || groupState.value === MediaState.pausedList);
const canRetry = computed(() => groupState.value === MediaState.done || groupState.value === MediaState.error);
const canViewInfo = computed(() => groupState.value !== MediaState.fetching);

const isValidExternalUrl = computed(() => {
  // Matches the requirement in 'src-tauri/capabilities/default.json' at 'permissions[4].allow[0].url'.
  const isAllowed = group.url.startsWith('https');
  if (!isAllowed) return false;
  try {
    new URL(group.url);
    return true;
  } catch {
    return false;
  }
});

const downloadItem = (): void => {
  emit('download');
};

const pauseItem = (): void => {
  emit('pause');
};

const resumeItem = (): void => {
  emit('resume');
};

const retryItem = (): void => {
  emit('retry');
};

const removeItem = (): void => {
  emit('remove');
};

const openExternalUrl = (): void => {
  void openUrl(group.url ?? '');
};
</script>
