<template>
  <section class="flex flex-row gap-6 py-4 px-8">
    <figure class="flex-grow-0 flex-shrink-1 aspect-video w-full max-w-120">
      <img
          :src="group?.thumbnail ?? placeholderUrl"
          :alt="t('media.view.thumbnailAlt', { title: group?.title ?? group?.url ?? t('common.video')})"
          class="object-cover rounded-box aspect-video"
          @error="setPlaceholderImage"
      />
    </figure>
    <div>
      <h1 class="text-xl font-semibold">{{ group?.title ?? group?.url }}</h1>
      <ul class="list w-full">
        <li v-if="group?.uploader" class="list-row">
          <p class="font-semibold">{{ t('media.view.metadata.uploader') }}</p>
          <p>
            {{ group.uploader }}
          </p>
        </li>
        <li v-if="group?.extractor" class="list-row">
          <p class="font-semibold">{{ t('media.view.metadata.extractor') }}</p>
          <p>
            {{ group.extractor }}
          </p>
        </li>
        <li v-if="group?.url" class="list-row">
          <p class="font-semibold">{{ t('media.view.metadata.link') }}</p>
          <a class="link" target="_blank" rel="noopener" :href="group.url">
            {{ group.url }}
          </a>
        </li>
      </ul>
    </div>
  </section>
  <section class="flex flex-col gap-4 pb-4 pt-0 px-8">
    <div class="overflow-x-scroll">
      <base-media-stats v-if="group" :item="group"/>
    </div>
    <h2 v-if="group?.description" class="font-semibold">{{ t('media.view.metadata.description') }}</h2>
    <p class="whitespace-pre max-h-44 overflow-y-scroll bg-base-100 p-4 rounded-box" v-if="group?.description">{{ group.description }}</p>
  </section>
</template>

<script setup lang="ts">
import placeholderUrl from '../../assets/placeholder.png';
import BaseMediaStats from '../base/BaseMediaStats.vue';
import { useI18n } from 'vue-i18n';
import { useMediaGroupStore } from '../../stores/media/group.ts';
import { Group } from '../../tauri/types/group.ts';

const { t } = useI18n();
const groupStore = useMediaGroupStore();

const { groupId } = defineProps({
  groupId: {
    type: String,
    required: true,
  },
});

const group: Group = groupStore.findGroupById(groupId);

const setPlaceholderImage = (event: Event): void => {
  if (event.target instanceof HTMLImageElement) {
    event.target.src = placeholderUrl;
  }
};
</script>
