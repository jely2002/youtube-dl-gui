import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sortFormats } from '../../helpers/formats';
import { invoke } from '@tauri-apps/api/core';
import {
  DownloadOptions,
  MediaAddPayload,
  MediaAddWithFormatPayload,
  TrackType,
} from '../../tauri/types/media';
import { useMediaGroupStore } from './group.ts';

export type Size = DownloadOptions & { size: number };

export const useMediaSizeStore = defineStore('media-size', () => {
  const sizes = ref<Record<string, Size[]>>({});
  const groupStore = useMediaGroupStore();

  const getSizes = (id: string): Size[] | undefined => {
    return sizes.value[id];
  };

  const getSize = (
    id: string,
    format: DownloadOptions,
  ): Size | undefined => {
    if (!format.abr && !format.fps && !format.height) {
      // Find the best format's size, if no options are passed.
      return sizes.value[id]?.find(s => !s.abr && !s.fps && !s.height);
    }
    return sizes.value[id]?.find((s) => {
      const matchesTrackType = s.trackType === format.trackType;
      const matchesVideo = format.height && s.height && s.height === format.height && s.fps === format.fps;
      const matchesAudio = format.abr && s.abr && s.abr === format.abr;
      return matchesTrackType && (matchesVideo || matchesAudio);
    });
  };

  const getSizeForGroup = (
    groupId: string,
    format: DownloadOptions,
  ): Size | undefined => {
    const group = groupStore.findGroupById(groupId);
    if (!group) return;
    let lastSize: Size | undefined;
    let totalSize = 0;

    for (const itemId of Object.keys(group.items)) {
      const itemSize = getSize(itemId, format);
      if (!itemSize) continue;

      lastSize = itemSize;
      totalSize += itemSize.size ?? 0;
    }

    return lastSize ? { ...lastSize, size: totalSize } : undefined;
  };

  const removeSizes = (id: string) => {
    delete sizes.value[id];
  };

  function processMediaAddPayload(payload: MediaAddPayload) {
    const item = payload.item;
    if (!item.formats) return;
    const highestFormat = sortFormats(item.formats)[0];
    sizes.value[payload.item.id] = [{
      ...highestFormat,
      trackType: TrackType.both,
      size: item.filesize,
    }];
  }

  function processMediaSizePayload(payload: MediaAddWithFormatPayload) {
    const item = payload.item;
    sizes.value[payload.item.id].push({
      ...payload.format,
      size: item.filesize,
    });
  }

  // This function will only work for a group with a single item.
  // If you want to request the size of a new group, this cannot be done for performance reasons.
  async function requestSize(
    url: string,
    groupId: string,
    id: string,
    format: DownloadOptions,
  ): Promise<void> {
    const group = groupStore.findGroupById(groupId);
    const headers = group?.urlHeaders ?? undefined;
    await invoke('media_size', {
      url,
      id,
      groupId,
      format,
      headers,
    });
  }

  return { sizes, getSizes, getSize, removeSizes, getSizeForGroup, processMediaAddPayload, processMediaSizePayload, requestSize };
});
