<template>
  <section
    v-if="chapters.length"
    class="rounded-box bg-base-100 p-4"
    aria-labelledby="chapters-heading"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 id="chapters-heading" class="font-semibold">
        {{ t('media.view.metadata.chapters') }}
      </h2>
      <span class="badge badge-soft">{{ chapters.length }}</span>
    </div>

    <div class="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-2">
      <ul class="timeline timeline-horizontal">
        <li v-for="(chapter, index) in chapterItems" :key="chapter.key">
          <hr v-if="index > 0">
          <div class="timeline-middle">
            <span class="block size-3 rounded-full bg-primary" aria-hidden="true" />
          </div>
          <div class="timeline-start mb-3 text-xs text-base-content/60 sm:text-sm">
            {{ chapter.rangeLabel }}
          </div>
          <article class="timeline-end timeline-box mt-3">
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-medium">
                {{ chapter.title || t('common.unknown') }}
              </h3>
              <span class="badge badge-ghost badge-sm shrink-0">
                {{ chapter.durationLabel }}
              </span>
            </div>
          </article>
          <hr v-if="index < chapterItems.length - 1">
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDuration } from '../../composables/useDuration';
import { Chapter } from '../../tauri/types/media';

const props = defineProps<{
  chapters: Chapter[];
  duration?: number;
}>();

const { t } = useI18n();

const chapterItems = computed(() =>
  props.chapters.map((chapter, index) => {
    const endTime = chapter.endTime > chapter.startTime
      ? chapter.endTime
      : (props.duration ?? chapter.startTime);
    const safeEndTime = Math.max(endTime, chapter.startTime);

    return {
      key: `${chapter.startTime}-${chapter.endTime}-${chapter.title}-${index}`,
      title: chapter.title,
      rangeLabel: `${formatDuration(chapter.startTime)} - ${formatDuration(safeEndTime)}`,
      durationLabel: formatDuration(Math.max(safeEndTime - chapter.startTime, 0)),
    };
  }),
);
</script>
