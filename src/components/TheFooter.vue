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
    <div class="w-full flex gap-4 justify-around max-w-4xl self-center">
      <base-button :to="{ name: 'location' }" tooltip-location="right" :tooltip="t('layout.footer.nav.downloadLocation')">
        <span class="sr-only">{{ t('layout.footer.nav.downloadLocation') }}</span>
        <folder-icon class="w-6 h-6"/>
      </base-button>
      <base-toggle-button
          :to="{ name: 'authentication' }"
          :tooltip="hasAuthConfigured ? t('layout.footer.nav.login.tooltip.on') : t('layout.footer.nav.login.tooltip.off')"
          :model-value="hasAuthConfigured">
        <template v-slot:on>
          <span class="sr-only">{{ t('layout.footer.nav.login.screenReader.on') }}</span>
          <key-icon-solid class="w-6 h-6"/>
        </template>
        <template v-slot:off>
          <span class="sr-only">{{ t('layout.footer.nav.login.screenReader.off') }}</span>
          <key-icon-outline class="w-6 h-6"/>
        </template>
      </base-toggle-button>
      <base-toggle-button :to="{ name: 'subtitles' }" :tooltip="t('layout.footer.nav.subtitles.tooltip')" :model-value="hasSubtitlesEnabled">
        <template v-slot:on>
          <span class="sr-only">{{ t('layout.footer.nav.subtitles.screenReader.on') }}</span>
          <chat-bubble-bottom-center-text-icon class="w-6 h-6"/>
        </template>
        <template v-slot:off>
          <div class="relative">
            <span class="sr-only">{{ t('layout.footer.nav.subtitles.screenReader.off') }}</span>
            <chat-bubble-bottom-center-icon class="w-6 h-6 absolute"/>
          </div>
        </template>
      </base-toggle-button>
      <div class="divider divider-horizontal mx-1"></div>
      <media-download-options
          v-model="selectedOptions"
          :formats="groupStore.getAllFormats()"
          :auto-select="false"
          locale-key="layout.footer.format"
      />
      <div class="divider divider-horizontal mx-1"></div>
      <base-button :tooltip="t('layout.footer.queue.empty')" @click="clearGroups">
        <span class="sr-only">{{ t('layout.footer.queue.empty') }}</span>
        <trash-icon class="w-6 h-6"/>
      </base-button>
      <base-button class="btn-primary" :disabled="progress.ready <= 0" @click="downloadAll" :loading="isStartingDownload">
        {{ t('common.download') }}
      </base-button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import {
  FolderIcon,
  TrashIcon,
  KeyIcon as KeyIconSolid,
} from '@heroicons/vue/24/solid';
import {
  ChatBubbleBottomCenterIcon,
  ChatBubbleBottomCenterTextIcon,
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

const i18n = useI18n();
const t = i18n.t;

const settingsStore = useSettingsStore();
const strongholdStore = useStrongholdStore();
const mediaStore = useMediaStore();
const progressStore = useMediaProgressStore();
const groupStore = useMediaGroupStore();
const optionsStore = useMediaOptionsStore();

const isStartingDownload = ref(false);

const clearGroups = (): void => {
  mediaStore.deleteAllGroups();
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

const hasAuthConfigured = computed(() => {
  return settingsStore.hasAuthConfigured() || strongholdStore.hasAvailableKeys();
});

const hasSubtitlesEnabled = computed(() => settingsStore.settings.subtitles.enabled);

</script>
