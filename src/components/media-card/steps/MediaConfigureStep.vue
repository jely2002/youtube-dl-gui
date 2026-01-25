<template>
  <div class="card-body py-0 pr-0 grow w-full min-w-0 grid grid-rows-3 grid-cols-2">
    <h2 :title="group.title ?? group.url" class="card-title block leading-8 overflow-hidden text-nowrap text-ellipsis text-base col-span-2">{{ group.title ?? group.url }}</h2>
    <media-download-options
        :formats="group.formats"
        :default-value="optionsStore.getGlobalOptions()"
        v-model="selectedOptions"
        class="flex gap-4 w-full col-start-1 col-end-3"
        approximate
    />
    <p class="mt-2 flex items-center">
      {{ t('media.steps.configure.metadata.duration', { duration: useDuration(group).value }) }}
    </p>
    <p v-if="!group.isCombined" class="mt-2 gap-1 flex items-center">
      {{ t('media.steps.configure.metadata.size') }}
      <template v-if="size">
        <span v-if="size">{{ size }}</span>
        <div class="tooltip tooltip-bottom" :data-tip="t('media.steps.configure.metadata.sizeInfo')">
          <information-circle-icon class="h-5 w-5 hover:opacity-60 transition-opacity"/>
        </div>
      </template>
      <button
        v-else-if="!settingsStore.settings.performance.autoLoadSize && !isSizeLoading"
        class="btn btn-soft btn-xs"
        @click="loadSize"
      >
        {{ t('common.load') }}
      </button>
      <span v-else class="loading loading-spinner loading-xs"></span>
    </p>
    <p v-else class="mt-2 flex items-center">
      {{ t('media.steps.configure.metadata.items', { amount: group.total, failedCount: failedItemDisplay }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref, watch } from 'vue';
import { DownloadOptions } from '../../../tauri/types/media';
import { useDuration } from '../../../composables/useDuration';
import { Size, useMediaSizeStore } from '../../../stores/media/size';
import { useSettingsStore } from '../../../stores/settings';
import { formatBytes } from '../../../helpers/units';
import { Group } from '../../../tauri/types/group';
import { useMediaOptionsStore } from '../../../stores/media/options';
import { useI18n } from 'vue-i18n';
import MediaDownloadOptions from '../MediaDownloadOptions.vue';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';

const i18n = useI18n();
const t = i18n.t;

const { group } = defineProps({
  group: {
    type: Object as PropType<Group>,
    required: true,
  },
});

const sizeStore = useMediaSizeStore();
const settingsStore = useSettingsStore();
const isSizeLoading = ref(false);
const optionsStore = useMediaOptionsStore();

const failedItemDisplay = computed(() => {
  return group?.errored > 0 ? t('media.steps.configure.metadata.failedCount', { amount: group?.errored }) : '';
});

const selectedOptions = computed({
  get: () => optionsStore.getOptions(group.id),
  set: (value: DownloadOptions) => optionsStore.setOptions(group.id, value),
});

const size = computed(() => {
  if (!selectedOptions.value) return;
  const mediaSize: Size | undefined = sizeStore.getSizeForGroup(group.id, selectedOptions.value);
  const size = mediaSize?.size;
  // Media size is available, but ytdlp returned none.
  if (size === null || size === 0) {
    return t('common.unknown');
  // No media size is available at all.
  } else if (size === undefined) {
    return null;
  // A media size is available and ytdlp returned one.
  } else {
    return formatBytes(size);
  }
});

watch(size, (val) => {
  if (val) {
    isSizeLoading.value = false;
  }
});

function loadSize() {
  if (!selectedOptions.value) return;
  isSizeLoading.value = true;
  void sizeStore.requestSize(
    group.url ?? '',
    group.id,
    group.items[Object.keys(group.items)[0]].id,
    selectedOptions.value,
  );
}

watch(selectedOptions, () => {
  const globalOptions = optionsStore.globalOptions;
  if (!selectedOptions.value && globalOptions) {
    optionsStore.applyOptionsToGroup(
      group,
      globalOptions,
    );
  }
  if (
    !group?.isCombined
    && settingsStore.settings.performance.autoLoadSize
    && selectedOptions.value
    && !sizeStore.getSizeForGroup(group.id, selectedOptions.value)
  ) {
    loadSize();
  } else {
    isSizeLoading.value = false;
  }
});

</script>
