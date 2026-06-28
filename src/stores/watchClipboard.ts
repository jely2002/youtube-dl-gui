import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useWatchClipboardStore = defineStore('watch-clipboard', () => {
  const enabled = ref(false);
  const seenUrls = ref<Set<string>>(new Set());

  const isActive = computed(() => enabled.value);

  function enable() {
    enabled.value = true;
  }

  function disable() {
    enabled.value = false;
    seenUrls.value = new Set();
  }

  function toggle() {
    if (enabled.value) {
      disable();
    } else {
      enable();
    }
  }

  function hasSeen(url: string): boolean {
    return seenUrls.value.has(url);
  }

  function markSeen(url: string) {
    seenUrls.value.add(url);
  }

  return {
    enabled,
    isActive,
    enable,
    disable,
    toggle,
    hasSeen,
    markSeen,
  };
});
