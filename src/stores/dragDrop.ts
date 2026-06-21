import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useToastStore } from './toast.ts';
import { useMediaStore } from './media/media.ts';
import {
  getUrlImportReadErrorToast,
  getUrlImportToast,
  isSupportedImportFile,
  mergeParsedUrlImports,
  parseUrlFileText,
  parseUrlInputText,
} from '../helpers/urlImport.ts';

type DropPayload = {
  urls: string[];
  files: File[];
};

export const useDragDropStore = defineStore('dragDrop', () => {
  const isOver = ref(false);

  function setOver() {
    isOver.value = true;
  }

  function reset() {
    isOver.value = false;
  }

  async function handleDrop(payload: DropPayload) {
    isOver.value = false;

    const toastStore = useToastStore();
    const mediaStore = useMediaStore();

    const supportedFiles = payload.files.filter(isSupportedImportFile);
    const parsedFiles = [];
    for (const file of supportedFiles) {
      try {
        parsedFiles.push(parseUrlFileText(await file.text()));
      } catch {
        const toast = getUrlImportReadErrorToast();
        toastStore.showToast(toast.message, { style: toast.style });
        return;
      }
    }

    const result = mergeParsedUrlImports([
      parseUrlInputText(payload.urls.join('\n')),
      ...parsedFiles,
    ]);

    if (result.urls.length > 0) {
      await mediaStore.addUrlBatch(result.urls);
    }

    const toast = getUrlImportToast(result);
    toastStore.showToast(toast.message, { style: toast.style });
  }

  return {
    isOver,
    setOver,
    reset,
    handleDrop,
  };
});
