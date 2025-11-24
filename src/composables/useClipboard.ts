import { ref, onMounted, onUnmounted, Ref, watch } from 'vue';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

export interface UseClipboardOptions {
  interval?: number;
  doPolling: Ref<boolean>;
}

export interface UseClipboardResponse {
  content: Ref<string | null>;
  poll: () => void;
}

export function useClipboard(options: UseClipboardOptions): UseClipboardResponse {
  const { interval = 1000 } = options;

  const content = ref<string | null>(null);
  let timer: number | null = null;
  let running = false;

  function pollOnce(): void {
    readText().then((text) => {
      if (text !== content.value) {
        content.value = text;
      }
    }).catch((e) => {
      if (e.includes('clipboard is empty')) return;
      console.error('Failed to read clipboard:', e);
    });
  }

  function start() {
    if (running) return;
    running = true;
    void pollOnce();
    timer = window.setInterval(pollOnce, interval);
  }

  function stop() {
    running = false;
    content.value = null;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  if (options.doPolling) {
    onMounted(start);
  }

  onUnmounted(stop);

  watch(options.doPolling, (value, oldValue) => {
    if (value === oldValue) return;

    if (value) {
      start();
    } else {
      stop();
    }
  });

  return {
    content,
    poll: pollOnce,
  };
}
