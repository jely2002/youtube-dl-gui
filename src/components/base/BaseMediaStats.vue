<template>
  <section class="stats" aria-labelledby="stats-heading">
    <h2 id="stats-heading" class="sr-only">{{ t('media.view.stats.title') }}</h2>

    <article class="stat" v-if="item.views">
      <div class="stat-figure text-secondary self-end">
        <eye-icon class="inline-block h-8 w-8 stroke-current" />
      </div>
      <h3 class="stat-title">{{ t('media.view.stats.views') }}</h3>
      <p class="stat-value text-2xl">{{ formatNumber(item.views) }}</p>
    </article>

    <article class="stat" v-if="item.likes || item.dislikes">
      <div class="stat-figure text-secondary flex space-x-1 self-end">
        <hand-thumb-up-icon v-if="item.likes" class="h-8 w-8 stroke-current" />
        <hand-thumb-down-icon v-if="item.dislikes" class="h-8 w-8 stroke-current" />
      </div>
      <h3 v-if="item.likes && item.dislikes" class="stat-title">
        {{ t('common.divide', { left: t('media.view.stats.likes'), right: t('media.view.stats.dislikes') }) }}
      </h3>
      <h3 v-else-if="item.likes" class="stat-title">{{ t('media.view.stats.likes') }}</h3>
      <h3 v-else class="stat-title">{{ t('media.view.stats.dislikes') }}</h3>
      <p v-if="item.likes && item.dislikes" class="stat-value text-2xl">
        {{ t('common.divide', { left: formatNumber(item.likes), right: formatNumber(item.dislikes) }) }}
      </p>
      <p v-else class="stat-value text-2xl">{{ formatNumber(item.likes ?? item.dislikes ?? 0) }}</p>
    </article>

    <article class="stat" v-if="item.comments">
      <div class="stat-figure text-secondary self-end">
        <chat-bubble-left-right-icon class="inline-block h-8 w-8 stroke-current" />
      </div>
      <h3 class="stat-title">{{ t('media.view.stats.comments') }}</h3>
      <p class="stat-value text-2xl">{{ item.comments }}</p>
    </article>

    <article class="stat" v-if="item.rating">
      <div class="stat-figure text-secondary self-end">
        <star-icon class="inline-block h-8 w-8 stroke-current" />
      </div>
      <h3 class="stat-title">{{ t('media.view.stats.rating') }}</h3>
      <p class="stat-value text-2xl">
        {{ t('common.divide', { left: formatNumber(item.rating), right: '5' }) }}
      </p>
    </article>

    <article class="stat" v-if="item.duration">
      <div class="stat-figure text-secondary self-end">
        <clock-icon class="inline-block h-8 w-8 stroke-current" />
      </div>
      <h3 class="stat-title">{{ t('media.view.stats.duration') }}</h3>
      <p class="stat-value text-2xl">{{ useDuration(item) }}</p>
    </article>
  </section>
</template>

<script setup lang="ts">

import { EyeIcon, ChatBubbleLeftRightIcon, ClockIcon, StarIcon, HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/vue/24/solid';
import { PropType } from 'vue';
import { MediaItem } from '../../tauri/types/media';
import { useDuration } from '../../composables/useDuration';
import { formatNumber } from '../../helpers/units';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { item } = defineProps({
  item: {
    type: Object as PropType<MediaItem>,
    required: true,
  },
});
</script>
