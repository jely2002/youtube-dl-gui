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

export type Size = DownloadOptions & { size: number | null };

export const useMediaSizeStore = defineStore('media-size', () => {
  const sizes = ref<Record<string, Size[]>>({});
  const groupStore = useMediaGroupStore();

  function matchesSizeRequest(a: DownloadOptions, b: DownloadOptions): boolean {
    if (a.trackType !== b.trackType) return false;

    if (a.trackType === TrackType.audio) {
      return a.abr === b.abr;
    }

    return a.height === b.height && a.fps === b.fps;
  }

  function findLastMatchingSize(id: string, predicate: (size: Size) => boolean): Size | undefined {
    const entries = sizes.value[id];
    if (!entries) return undefined;

    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (predicate(entry)) {
        return entry;
      }
    }

    return undefined;
  }

  const getSizes = (id: string): Size[] | undefined => {
    return sizes.value[id];
  };

  const getSize = (
    id: string,
    format: DownloadOptions,
  ): Size | undefined => {
    if (!format.abr && !format.fps && !format.height) {
      // Find the best format's size, if no options are passed.
      return findLastMatchingSize(id, s => !s.abr && !s.fps && !s.height);
    }
    return findLastMatchingSize(id, s => matchesSizeRequest(s, format));
  };

  const getSizeForGroup = (
    groupId: string,
    format: DownloadOptions,
  ): Size | undefined => {
    const group = groupStore.findGroupById(groupId);
    if (!group) return;
    let lastSize: Size | undefined;
    let totalSize = 0;
    let sawKnownSize = false;

    for (const itemId of Object.keys(group.items)) {
      const itemSize = getSize(itemId, format);
      if (!itemSize) continue;

      lastSize = itemSize;
      if (itemSize.size != null) {
        totalSize += itemSize.size;
        sawKnownSize = true;
      }
    }

    return lastSize ? { ...lastSize, size: sawKnownSize ? totalSize : null } : undefined;
  };

  const removeSizes = (id: string) => {
    delete sizes.value[id];
  };

  function processMediaAddPayload(payload: MediaAddPayload) {
    const item = payload.item;
    if (!item.formats) return;
    const highestFormat = sortFormats(item.formats)[0];
    if (item.filesize != null) {
      sizes.value[payload.item.id] = [{
        ...highestFormat,
        trackType: TrackType.both,
        size: item.filesize,
      }];
    } else {
      sizes.value[payload.item.id] = [];
    }
  }

  function processMediaSizePayload(payload: MediaAddWithFormatPayload) {
    const item = payload.item;
    const nextSize: Size = {
      ...payload.format,
      size: item.filesize,
    };

    const entries = sizes.value[payload.item.id] ?? [];
    const existingIndex = entries.findIndex(entry => matchesSizeRequest(entry, payload.format));

    if (existingIndex >= 0) {
      entries.splice(existingIndex, 1, nextSize);
    } else {
      entries.push(nextSize);
    }

    sizes.value[payload.item.id] = entries;
  }

  // This function will only work for a group with a single item.
  // If you want to request the size of a new group, this cannot be done for performance reasons.
  async function requestSize(
    url: string,
    groupId: string,
    id: string,
    format: DownloadOptions,
  ): Promise<void> {
    await invoke('media_size', {
      url,
      id,
      groupId,
      format,
    });
  }

  return { sizes, getSizes, getSize, removeSizes, getSizeForGroup, processMediaAddPayload, processMediaSizePayload, requestSize };
});
