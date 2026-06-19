import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { AudioQualityResult } from '../../tauri/types/media';

export const useMediaAudioQualityStore = defineStore('media-audio-quality', () => {
  const results = ref<Record<string, AudioQualityResult>>({});
  const errors = ref<Record<string, string>>({});
  const loading = ref<Record<string, boolean>>({});

  const getResult = (groupId: string): AudioQualityResult | undefined => results.value[groupId];
  const getError = (groupId: string): string | undefined => errors.value[groupId];
  const isLoading = (groupId: string): boolean => loading.value[groupId] ?? false;

  async function checkQuality(groupId: string, path: string): Promise<void> {
    loading.value[groupId] = true;
    delete errors.value[groupId];
    try {
      results.value[groupId] = await invoke<AudioQualityResult>('media_check_audio_quality', { path });
    } catch (e) {
      errors.value[groupId] = String(e);
    } finally {
      loading.value[groupId] = false;
    }
  }

  const removeResult = (groupId: string) => {
    delete results.value[groupId];
    delete errors.value[groupId];
    delete loading.value[groupId];
  };

  return { results, errors, loading, getResult, getError, isLoading, checkQuality, removeResult };
});
