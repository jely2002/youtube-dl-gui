import { computed, onMounted, ref } from 'vue';
import { Platform } from '../tauri/types/app.ts';
import { invoke } from '@tauri-apps/api/core';

export function usePlatform() {
  const platform = ref<Platform>(Platform.Unknown);

  onMounted(async () => {
    try {
      platform.value = await invoke<Platform>('get_platform');
    } catch (e) {
      console.warn('Unable to retrieve platform from Rust.', e);
    }
  });

  const isWindows = computed(() => platform.value === Platform.Windows);
  const isMac = computed(() => platform.value === Platform.MacOS);

  return { isWindows, isMac, platform };
}
