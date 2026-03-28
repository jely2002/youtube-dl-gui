<template>
  <section class="flex flex-row gap-6 py-4 px-8">
    <figure class="flex-grow-0 flex-shrink-1 aspect-video w-full max-w-100">
      <img
        :src="group?.thumbnail ?? placeholderUrl"
        :alt="t('media.view.thumbnailAlt', { title: group?.title ?? group?.url ?? t('common.video') })"
        class="aspect-video rounded-box object-cover"
        @error="setPlaceholderImage"
      />
    </figure>
    <div class="min-w-0 flex-1">
      <h1 class="break-words text-xl font-semibold">{{ group?.title ?? group?.url }}</h1>
      <ul v-if="metadataItems.length" class="list w-full">
        <li v-for="item in metadataItems" :key="item.label" class="list-row">
          <p class="font-semibold">{{ item.label }}</p>
          <a
            v-if="item.href"
            class="link break-all"
            target="_blank"
            rel="noopener"
            :href="item.href"
          >
            {{ item.value }}
          </a>
          <p v-else>{{ item.value }}</p>
        </li>
      </ul>
    </div>
  </section>
  <section class="flex flex-col gap-4 pb-4 pt-0 px-8">
    <div class="overflow-x-scroll">
      <base-media-stats v-if="group" :item="group" />
    </div>
    <div class="rounded-box p-4 bg-base-100" v-if="group?.description">
      <h2 class="font-semibold mb-3">{{ t('media.view.metadata.description') }}</h2>
      <p class="max-h-44 whitespace-pre overflow-y-auto">
        {{ group.description }}
      </p>
    </div>
    <media-chapter-timeline
        v-if="group?.chapters?.length"
        :chapters="group.chapters"
        :duration="group.duration"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import placeholderUrl from '../../assets/placeholder.png';
import BaseMediaStats from '../base/BaseMediaStats.vue';
import MediaChapterTimeline from './MediaChapterTimeline.vue';
import { useI18n } from 'vue-i18n';
import { useMediaGroupStore } from '../../stores/media/group.ts';

const { t } = useI18n();
const groupStore = useMediaGroupStore();

const props = defineProps<{
  groupId: string;
}>();

const group = computed(() => groupStore.findGroupById(props.groupId));

type MetadataItem = {
  label: string;
  value: string;
  href?: string;
};

const metadataItems = computed<MetadataItem[]>(() => {
  const currentGroup = group.value;

  if (!currentGroup) {
    return [];
  }

  return [
    currentGroup.uploader
      ? { label: t('media.view.metadata.uploader'), value: currentGroup.uploader }
      : undefined,
    currentGroup.extractor
      ? { label: t('media.view.metadata.extractor'), value: currentGroup.extractor }
      : undefined,
    currentGroup.url
      ? { label: t('media.view.metadata.link'), value: currentGroup.url, href: currentGroup.url }
      : undefined,
  ].filter((item): item is MetadataItem => Boolean(item));
});

const setPlaceholderImage = (event: Event): void => {
  if (event.target instanceof HTMLImageElement) {
    event.target.src = placeholderUrl;
  }
};
</script>
