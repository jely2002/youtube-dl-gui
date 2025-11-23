import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useToastStore } from './toast.ts';
import { useMediaStore } from './media/media.ts';

export const useDragDropStore = defineStore('dragDrop', () => {
  const isOver = ref(false);

  function setOver() {
    isOver.value = true;
  }

  function reset() {
    isOver.value = false;
  }

  async function handleDrop(paths: string[]) {
    isOver.value = false;

    const toastStore = useToastStore();
    const mediaStore = useMediaStore();

    const urlPaths: string[] = [];
    for (const path of paths) {
      try {
        const url = new URL(path);
        if (!/^https?:$/.test(url.protocol)) continue;
        urlPaths.push(path);
      } catch {}
    }

    if (urlPaths.length === 0) {
      toastStore.showToast(`The dropped item can't be added to the queue.`, { style: 'warning' });
      return;
    }

    await Promise.all(
      urlPaths.map(path => mediaStore.dispatchMediaInfoFetch(path)),
    );

    if (urlPaths.length === 1) {
      toastStore.showToast('Link added to queue.', { style: 'info' });
    } else {
      toastStore.showToast(`${urlPaths.length} links added to queue.`, {
        style: 'info',
      });
    }
  }

  return {
    isOver,
    setOver,
    reset,
    handleDrop,
  };
});
