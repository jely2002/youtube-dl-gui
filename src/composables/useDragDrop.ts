import { onMounted, onUnmounted } from 'vue';
import { useDragDropStore } from '../stores/dragDrop.ts';

function hasUrlData(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return dataTransfer.types.includes('text/uri-list') || dataTransfer.types.includes('text/plain');
}

function extractUrls(dataTransfer: DataTransfer | null): string[] {
  if (!dataTransfer) return [];

  const urls: string[] = [];

  if (dataTransfer.types.includes('text/uri-list')) {
    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
      urls.push(
        ...uriList
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#')),
      );
    }
  } else if (dataTransfer.types.includes('text/plain')) {
    const text = dataTransfer.getData('text/plain').trim();
    urls.push(text);
  }

  return urls;
}

export function useDragDrop() {
  const store = useDragDropStore();

  let dragDepth = 0;

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault();

    if (!hasUrlData(event.dataTransfer)) return;

    dragDepth += 1;
    if (dragDepth === 1) {
      store.setOver();
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();

    if (!hasUrlData(event.dataTransfer)) return;

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();

    if (!hasUrlData(event.dataTransfer)) return;

    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      store.reset();
    }
  };

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();

    if (!hasUrlData(event.dataTransfer)) return;

    const urls = extractUrls(event.dataTransfer);
    dragDepth = 0;
    store.reset();

    if (urls.length > 0) {
      await store.handleDrop(urls);
    }
  };

  onMounted(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
  });

  onUnmounted(() => {
    window.removeEventListener('dragenter', handleDragEnter);
    window.removeEventListener('dragover', handleDragOver);
    window.removeEventListener('dragleave', handleDragLeave);
    window.removeEventListener('drop', handleDrop);
  });
}
