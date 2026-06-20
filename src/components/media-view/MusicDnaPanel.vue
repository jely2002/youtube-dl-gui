<template>
  <div class="rounded-box p-4 bg-base-100">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="font-semibold">{{ t('media.view.musicDna.title') }}</h2>
      <button type="button" class="btn btn-primary btn-sm" :disabled="isLoading" @click="buildRecommendations">
        {{ t('media.view.musicDna.build') }}
      </button>
    </div>
    <p class="label">{{ t('media.view.musicDna.description') }}</p>

    <p v-if="errorMessage" class="alert alert-error alert-soft mt-3">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="mt-3">{{ t('common.loading') }}</p>
    <p v-else-if="response?.lowConfidence" class="alert alert-warning alert-soft mt-3">
      {{ t('media.view.musicDna.lowConfidence') }}
    </p>

    <ul v-if="rankedSuggestions.length" class="list mt-3">
      <li v-for="suggestion in rankedSuggestions" :key="`${suggestion.title}-${suggestion.artist}`" class="list-row">
        <div class="w-full">
          <div class="flex items-center justify-between gap-3">
            <p class="font-semibold">{{ suggestion.title }} — {{ suggestion.artist }}</p>
            <span class="badge badge-outline">{{ Math.round(suggestion.confidence * 100) }}%</span>
          </div>
          <p class="text-sm opacity-90">{{ suggestion.rationale }}</p>
          <div class="mt-2 flex gap-2 flex-wrap">
            <a v-if="suggestion.url" class="btn btn-xs btn-outline" :href="suggestion.url" target="_blank" rel="noopener">
              {{ t('media.view.musicDna.open') }}
            </a>
            <button type="button" class="btn btn-xs" @click="rememberFeedback(suggestion, true)">
              {{ t('media.view.musicDna.feedback.good') }}
            </button>
            <button type="button" class="btn btn-xs" @click="rememberFeedback(suggestion, false)">
              {{ t('media.view.musicDna.feedback.bad') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import type { Group } from '../../tauri/types/group.ts';
import type { MusicDnaRequest, MusicDnaResponse, MusicDnaSuggestion } from '../../tauri/types/musicDna.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { isValidUrl } from '../../helpers/url.ts';
import { rankMusicDnaSuggestions } from '../../helpers/musicDna.ts';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const props = defineProps<{
  group: Group;
}>();

const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const response = ref<MusicDnaResponse | null>(null);

const rankedSuggestions = computed<MusicDnaSuggestion[]>(() => {
  if (!response.value) return [];
  return rankMusicDnaSuggestions(response.value.suggestions, settingsStore.settings.musicDna);
});

const parseMusicDnaError = (error: unknown): string => {
  const raw = `${error}`;
  if (raw.includes('music_dna::missing_api_key::')) return t('media.view.musicDna.errors.missingApiKey');
  if (raw.includes('music_dna::rate_limited::') || raw.includes('music_dna::provider_rate_limited::')) {
    return t('media.view.musicDna.errors.rateLimited');
  }
  if (raw.includes('music_dna::feature_disabled::')) return t('media.view.musicDna.errors.disabled');
  if (raw.includes('music_dna::invalid_url::')) return t('media.view.musicDna.errors.invalidUrl');
  return t('media.view.musicDna.errors.generic');
};

const buildRecommendations = async (): Promise<void> => {
  if (!isValidUrl(props.group.url)) {
    errorMessage.value = t('media.view.musicDna.errors.invalidUrl');
    return;
  }

  isLoading.value = true;
  errorMessage.value = null;
  try {
    const request: MusicDnaRequest = {
      songUrl: props.group.url,
      title: props.group.title,
      artist: props.group.uploader,
      description: props.group.description,
      durationSeconds: props.group.duration ? Math.round(props.group.duration) : undefined,
    };

    const result = await invoke<MusicDnaResponse>('music_dna_recommend', { request });
    response.value = result;

    const nextSeedHistory = [
      {
        url: props.group.url,
        title: props.group.title,
        artist: props.group.uploader,
      },
      ...settingsStore.settings.musicDna.seedHistory,
    ].slice(0, 30);
    await settingsStore.patch({ musicDna: { seedHistory: nextSeedHistory } });
  } catch (error) {
    errorMessage.value = parseMusicDnaError(error);
  } finally {
    isLoading.value = false;
  }
};

const rememberFeedback = async (suggestion: MusicDnaSuggestion, isPositive: boolean): Promise<void> => {
  const entry = `${isPositive ? 'good' : 'bad'}|${suggestion.title}|${suggestion.artist}`;
  const feedbackMemory = [entry, ...settingsStore.settings.musicDna.feedbackMemory].slice(0, 60);
  await settingsStore.patch({ musicDna: { feedbackMemory } });
};
</script>
