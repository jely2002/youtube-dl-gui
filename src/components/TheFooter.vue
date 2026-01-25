<template>
  <footer class="p-4 bg-base-300 flex flex-col gap-4 justify-center w-full shadow-lg">
    <base-progress v-if="isDownloading" :max="progress.total" :value="progress.done" id="total">
      {{ t('layout.footer.progress.downloading', { done: progress.done, total: progress.total }) }}
    </base-progress>
    <base-progress v-else-if="isCompleted" :max="progress.total" :value="progress.done" id="total">
      {{ t('layout.footer.progress.completed', progress.total) }}
    </base-progress>
    <base-progress v-else :max="1" :value="0" id="total">
      {{ t('layout.footer.progress.ready', progress.ready) }}
    </base-progress>
    <div class="w-full flex max-w-4xl self-center justify-center">
      <div class="join divide-x-2">
        <base-button class="join-item" :to="{ name: 'location' }" :tooltip="t('layout.footer.nav.downloadLocation')">
          <span class="sr-only">{{ t('layout.footer.nav.downloadLocation') }}</span>
          <folder-icon class="w-5 h-5"/>
        </base-button>
        <base-toggle-button
            :to="{ name: 'authentication' }"
            :tooltip="hasAuthConfigured ? t('layout.footer.nav.login.tooltip.on') : t('layout.footer.nav.login.tooltip.off')"
            :model-value="hasAuthConfigured"
            class="join-item"
        >
          <template v-slot:on>
            <span class="sr-only">{{ t('layout.footer.nav.login.screenReader.on') }}</span>
            <key-icon-solid class="w-5 h-5"/>
          </template>
          <template v-slot:off>
            <span class="sr-only">{{ t('layout.footer.nav.login.screenReader.off') }}</span>
            <key-icon-outline class="w-5 h-5"/>
          </template>
        </base-toggle-button>
        <base-toggle-button
            :to="{ name: 'subtitles' }"
            :tooltip="t('layout.footer.nav.subtitles.tooltip')"
            :model-value="hasSubtitlesEnabled"
            class="join-item"
        >
          <template v-slot:on>
            <span class="sr-only">{{ t('layout.footer.nav.subtitles.screenReader.on') }}</span>
            <chat-bubble-bottom-center-text-icon class="w-5 h-5"/>
          </template>
          <template v-slot:off>
            <div class="relative">
              <span class="sr-only">{{ t('layout.footer.nav.subtitles.screenReader.off') }}</span>
              <chat-bubble-bottom-center-icon class="w-5 h-5 absolute"/>
            </div>
          </template>
        </base-toggle-button>
      </div>
      <div class="divider divider-horizontal mx-2"></div>
      <media-download-options
          v-model="selectedOptions"
          :formats="groupStore.getAllFormats()"
          :auto-select="false"
          locale-key="layout.footer.format"
          class="w-fit grow"
          join
      />
      <div class="divider divider-horizontal mx-2"></div>
      <base-button-dropdown
          placement="top"
          align="end"
          btnClass="btn-subtle"
          :disabled="!hasGroups"
          :caret-disabled="!hasQueueActions"
          :mainTooltip="t('layout.footer.queue.empty')"
          :caretAriaLabel="t('layout.footer.queue.more')"
          caretClass="px-2"
          @mainClick="clearGroups"
      >
        <template #main>
          <span class="sr-only">{{ t('layout.footer.queue.empty') }}</span>
          <trash-icon class="w-5 h-5" />
        </template>

        <template #caret>
          <chevron-down-icon class="w-4 h-4" />
        </template>

        <li>
          <button class="gap-2 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!hasSuccessfulGroups" @click="clearSuccessfulGroups">
            <broom-icon class="w-4 h-4" />
            {{ t('layout.footer.queue.clearSuccessful') }}
          </button>
        </li>
        <li>
          <button class="gap-2 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!hasErroredGroups" @click="clearErroredGroups">
            <broom-icon class="w-4 h-4" />
            {{ t('layout.footer.queue.clearErrored') }}
          </button>
        </li>
        <li>
          <button class="gap-2 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!hasPendingGroups" @click="clearPendingGroups">
            <broom-icon class="w-4 h-4" />
            {{ t('layout.footer.queue.clearPending') }}
          </button>
        </li>
        <li>
          <button class="gap-2 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!hasDownloadingGroups" @click="cancelDownloadingGroups">
            <x-mark-icon class="w-4 h-4" />
            {{ t('layout.footer.queue.cancelDownloading') }}
          </button>
        </li>
        <li>
          <button class="gap-2 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!hasDownloadingGroups" @click="pauseAllGroups">
            <pause-icon class="w-4 h-4" />
            {{ t('layout.footer.queue.pause') }}
          </button>
        </li>
        <li>
          <button class="gap-2 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!hasPausedGroups" @click="resumeAllGroups">
            <play-icon class="w-4 h-4" />
            {{ t('layout.footer.queue.resume') }}
          </button>
        </li>
      </base-button-dropdown>
      <base-button class="btn-primary ml-2" :disabled="progress.ready <= 0" @click="downloadAll" :loading="isStartingDownload">
        {{ t('common.download') }}
      </base-button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { FolderIcon, KeyIcon as KeyIconSolid, PauseIcon, PlayIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/solid';
import {
  ChatBubbleBottomCenterIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronDownIcon,
  KeyIcon as KeyIconOutline,
} from '@heroicons/vue/24/outline';
import BaseProgress from './base/BaseProgress.vue';
import { useSettingsStore } from '../stores/settings';
import { computed, ref, watch } from 'vue';
import BaseButton from './base/BaseButton.vue';
import { useMediaStore } from '../stores/media/media';
import { useMediaProgressStore } from '../stores/media/progress';
import { DownloadOptions } from '../tauri/types/media';
import { useMediaOptionsStore } from '../stores/media/options';
import BaseToggleButton from './base/BaseToggleButton.vue';
import { useStrongholdStore } from '../stores/stronghold';
import { useI18n } from 'vue-i18n';
import MediaDownloadOptions from './media-card/MediaDownloadOptions.vue';
import { useMediaGroupStore } from '../stores/media/group.ts';
import BaseButtonDropdown from './base/BaseButtonDropdown.vue';
import { MediaState, useMediaStateStore } from '../stores/media/state.ts';
import BroomIcon from './icons/BroomIcon.vue';

const i18n = useI18n();
const t = i18n.t;

const settingsStore = useSettingsStore();
const strongholdStore = useStrongholdStore();
const mediaStore = useMediaStore();
const mediaStateStore = useMediaStateStore();
const progressStore = useMediaProgressStore();
const groupStore = useMediaGroupStore();
const optionsStore = useMediaOptionsStore();

const isStartingDownload = ref(false);

const clearGroups = (): void => {
  mediaStore.deleteAllGroups();
};

const clearSuccessfulGroups = (): void => {
  mediaStore.deleteGroupsByState([MediaState.done]);
};

const clearErroredGroups = (): void => {
  mediaStore.deleteGroupsByState([MediaState.error]);
};

const clearPendingGroups = (): void => {
  mediaStore.deleteGroupsByState([
    MediaState.fetching,
    MediaState.fetchingList,
    MediaState.configure,
    MediaState.paused,
    MediaState.pausedList,
  ]);
};

const cancelDownloadingGroups = (): void => {
  mediaStore.deleteGroupsByState([MediaState.downloading, MediaState.downloadingList]);
};

const progress = computed(() => {
  return progressStore.findAllProgress();
});

const isDownloading = computed(() => {
  return (progress.value.downloading ?? 0) > 0;
});

const isCompleted = computed(() => {
  return (progress.value.downloading ?? 0) === 0 && (progress.value.ready ?? 0) === 0 && (progress.value.done ?? 0) > 0;
});

const selectedOptions = ref<DownloadOptions | undefined>(optionsStore.getGlobalOptions());

function applySelection() {
  const globalOptions = selectedOptions.value;
  if (!globalOptions) return;
  optionsStore.applyGlobalOptions(globalOptions);
}

watch(selectedOptions, applySelection, { immediate: true });

const downloadAll = async (): Promise<void> => {
  isStartingDownload.value = true;
  try {
    await mediaStore.downloadAllGroups();
  } catch (e) {
    console.error(e);
  } finally {
    isStartingDownload.value = false;
  }
};

const pauseAllGroups = (): void => {
  mediaStore.pauseAllGroups();
};

const resumeAllGroups = (): void => {
  mediaStore.resumeAllGroups();
};

const hasAuthConfigured = computed(() => {
  return settingsStore.hasAuthConfigured() || strongholdStore.hasAvailableKeys();
});
const hasSubtitlesEnabled = computed(() => settingsStore.settings.subtitles.enabled);
const hasGroups = computed(() => groupStore.countGroups() > 0);
const hasSuccessfulGroups = computed(() => mediaStateStore.hasGroupWithState(MediaState.done));
const hasErroredGroups = computed(() => mediaStateStore.hasGroupWithState(MediaState.error));
const hasPendingGroups = computed(() => mediaStateStore.hasGroupWithState(
  MediaState.fetching,
  MediaState.fetchingList,
  MediaState.configure,
  MediaState.paused,
  MediaState.pausedList,
));
const hasPausedGroups = computed(() => mediaStateStore.hasGroupWithState(MediaState.paused, MediaState.pausedList));
const hasDownloadingGroups = computed(() => mediaStateStore.hasGroupWithState(MediaState.downloading, MediaState.downloadingList));
const hasQueueActions = computed(() => (
  hasSuccessfulGroups.value
  || hasErroredGroups.value
  || hasPendingGroups.value
  || hasPausedGroups.value
  || hasDownloadingGroups.value
));
</script>
