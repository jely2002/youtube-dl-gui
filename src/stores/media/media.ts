import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { MediaState, useMediaStateStore } from './state';
import { useMediaGroupStore } from './group';
import { useMediaDestinationStore } from './destination';
import { useMediaProgressStore } from './progress';
import { useMediaOptionsStore } from './options';
import { DownloadOptions, MediaAddPayload, MediaItem, TrackType } from '../../tauri/types/media';
import { useMediaSizeStore } from './size.ts';
import { useMediaDiagnosticsStore } from './diagnostics.ts';
import { useSettingsStore } from '../settings.ts';

export const useMediaStore = defineStore('media', () => {
  const groupStore = useMediaGroupStore();
  const stateStore = useMediaStateStore();
  const progressStore = useMediaProgressStore();
  const destinationStore = useMediaDestinationStore();
  const optionsStore = useMediaOptionsStore();
  const sizeStore = useMediaSizeStore();
  const diagnosticsStore = useMediaDiagnosticsStore();
  const settingsStore = useSettingsStore();

  function processMediaAddPayload(payload: MediaAddPayload) {
    const { item, groupId, total } = payload;
    item.groupId = groupId;

    const group = groupStore.findGroupById(groupId);
    if (!group) throw new Error('Orphaned media item found.');

    const isFirst = group.total === 1;
    if (isFirst) {
      const existingId = Object.keys(group.items)[0];
      if (existingId) delete group.items[existingId];
    }
    item.isLeader = isFirst;
    group.items[item.id] = item;

    if (isFirst) {
      const { id, groupId: gid, isLeader, ...meta } = item;
      void id;
      void gid;
      void isLeader;
      Object.assign(group, meta);
    }

    group.total = total;
    if (!isFirst) group.processed++;

    if (group.processed === total) {
      const splitThreshold = settingsStore.settings.performance.splitPlaylistThreshold;
      if (group.total < splitThreshold) {
        // Too few to combine, split up into separate groups.
        const newGroups = groupStore.splitGroup(group);
        for (const newGroup of newGroups) {
          stateStore.setGroupState(newGroup.id, MediaState.configure);
        }
      } else {
        // Combine into a group with one leader.
        groupStore.consolidateGroup(group);
        stateStore.setGroupState(group.id, MediaState.configure);
      }
    }

    const next = total > 1 && isFirst
      ? MediaState.fetchingList
      : MediaState.configure;
    stateStore.setState(item.id, next);
  }

  async function dispatchMediaInfoFetch(url: string) {
    const id = uuidv4();
    const groupId = uuidv4();

    stateStore.setState(id, MediaState.fetching);
    groupStore.createGroup({
      id: groupId,
      total: 1,
      processed: 0,
      errored: 0,
      isCombined: false,
      url,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        [id]: {
          id,
          isLeader: true,
          url,
          audioCodecs: [],
          formats: [],
          filesize: 0,
        },
      },
    });

    await invoke('media_info', { url, id, groupId });
  }

  async function downloadGroup(
    groupId: string,
    options: DownloadOptions,
  ) {
    const group = groupStore.findGroupById(groupId);
    if (!group) return;

    const items: MediaItem[] = Object.values(group.items);
    const itemsWithoutLeader: MediaItem[] = items.filter(item => !item.entries);

    if (itemsWithoutLeader.length === 0) return;

    const newState = group.isCombined ? MediaState.downloadingList : MediaState.downloading;
    items.forEach(item => stateStore.setState(item.id, newState));

    await invoke<string>('media_download', {
      groupId,
      items: itemsWithoutLeader.map(item => ({
        id: item.id,
        url: item.url,
        format: options,
      })),
    });
  }

  async function downloadAllGroups() {
    const group_ids = Object.keys(groupStore.groups);

    await Promise.all(group_ids.map((gid) => {
      const opts = optionsStore.getOptions(gid) ?? { trackType: TrackType.both };
      return downloadGroup(gid, opts);
    }));
  }

  function deleteGroup(id: string) {
    const group = groupStore.findGroupById(id);
    for (const itemId of Object.keys(group.items)) {
      stateStore.removeState(itemId);
      progressStore.deleteProgress(itemId);
      sizeStore.removeSizes(itemId);
      diagnosticsStore.removeDiagnostics(itemId);
    }
    diagnosticsStore.removeDiagnostics(group.id);
    destinationStore.deleteDestinations(group.id);
    optionsStore.removeOptions(group.id);
    groupStore.cancelGroup(group.id);
    groupStore.deleteGroup(group.id);
  }

  function deleteAllGroups() {
    const groups = groupStore.groups;
    for (const group of Object.values(groups)) {
      deleteGroup(group.id);
    }
  }

  return {
    processMediaAddPayload,
    dispatchMediaInfoFetch,
    downloadGroup,
    downloadAllGroups,
    deleteGroup,
    deleteAllGroups,
  };
});
