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
import { Group } from '../../tauri/types/group.ts';
import { notify, notifyGroup } from '../../tauri/notifications';
import { NotificationKind } from '../../tauri/types/app';

export const useMediaStore = defineStore('media', () => {
  const groupStore = useMediaGroupStore();
  const stateStore = useMediaStateStore();
  const progressStore = useMediaProgressStore();
  const destinationStore = useMediaDestinationStore();
  const optionsStore = useMediaOptionsStore();
  const sizeStore = useMediaSizeStore();
  const diagnosticsStore = useMediaDiagnosticsStore();
  const settingsStore = useSettingsStore();

  function finalizePlaylistGroup(group: Group) {
    const splitThreshold = settingsStore.settings.performance.splitPlaylistThreshold;
    if (group.total < splitThreshold) {
      const newGroups = groupStore.splitGroup(group);
      void notifyGroup(NotificationKind.PlaylistReady, group, {}, newGroups.length);
      if (newGroups.length === 0) {
        stateStore.setGroupState(group.id, MediaState.configure);
        return;
      }
      for (const newGroup of newGroups) {
        stateStore.setGroupState(newGroup.id, MediaState.configure);
      }
    } else {
      groupStore.consolidateGroup(group);
      void notifyGroup(NotificationKind.PlaylistReady, group, {}, group.entries?.length ?? 1);
      stateStore.setGroupState(group.id, MediaState.configure);
    }
  }

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
      finalizePlaylistGroup(group);
    } else if (group.total === 1) {
      void notifyGroup(NotificationKind.VideoReady, group);
    }

    const next = total > 1 && isFirst
      ? MediaState.fetchingList
      : MediaState.configure;
    stateStore.setState(item.id, next);
  }

  async function dispatchMediaInfoFetch(url: string, fromShortcut: boolean = false) {
    const id = uuidv4();
    const groupId = uuidv4();

    stateStore.setState(id, MediaState.fetching);
    const newGroup: Group = {
      id: groupId,
      total: 1,
      processed: 0,
      errored: 0,
      isCombined: false,
      url,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      fromShortcut,
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
    };
    groupStore.createGroup(newGroup);

    await invoke('media_info', { url, id, groupId });
    await notifyGroup(NotificationKind.QueueAdded, newGroup);
  }

  async function downloadGroup(
    groupId: string,
    options: DownloadOptions,
  ) {
    const group = groupStore.findGroupById(groupId);
    if (!group) return;

    const items: MediaItem[] = Object.values(group.items);
    const itemsWithoutLeader: MediaItem[] = items.filter(item => !item.entries && stateStore.getState(item.id) !== MediaState.done);

    if (itemsWithoutLeader.length === 0) return;

    const newState = group.isCombined ? MediaState.downloadingList : MediaState.downloading;
    items
      .filter(item => stateStore.getState(item.id) !== MediaState.done)
      .forEach(item => stateStore.setState(item.id, newState));

    try {
      await invoke<string>('media_download', {
        groupId,
        items: itemsWithoutLeader.map(item => ({
          id: item.id,
          url: item.url,
          format: options,
          templateContext: {
            values: buildTemplateContext(item, group),
          },
        })),
      });
    } catch (e) {
      diagnosticsStore.processMediaFatalPayload({
        groupId,
        id: groupId,
        exitCode: 1,
        internal: true,
        message: `${e}`,
        details: null,
        timestamp: Date.now(),
      });
      console.error(e);
    }
  }

  async function pauseGroup(groupId: string) {
    const group = groupStore.findGroupById(groupId);
    if (!group) return;

    const items: MediaItem[] = Object.values(group.items);
    const itemsWithoutLeader: MediaItem[] = items.filter(item => !item.entries);

    if (itemsWithoutLeader.length === 0) return;

    const newState = group.isCombined ? MediaState.pausedList : MediaState.paused;
    items
      .filter(item => stateStore.getState(item.id) !== MediaState.done)
      .forEach(item => stateStore.setState(item.id, newState));

    groupStore.cancelGroup(groupId);
  }

  function buildTemplateContext(item: MediaItem, group: Group): Record<string, string | undefined> {
    return {
      playlist_index: item.playlistIndex?.toString(),
      playlist_id: group.playlistId ?? undefined,
      playlist_title: group.playlistTitle ?? undefined,
      playlist: group.playlistTitle ?? undefined,
      playlist_uploader: group.uploader ?? undefined,
      playlist_uploader_id: group.uploaderId ?? undefined,
      playlist_count: group.playlistCount?.toString(),
      n_entries: group.entries?.length?.toString(),
    };
  }

  async function downloadAllGroups(fromShortcut: boolean = false) {
    const group_ids = groupStore.groupOrder
      .filter(gid => stateStore.getGroupState(gid) === MediaState.configure);

    await Promise.all(group_ids.map((gid) => {
      const opts = optionsStore.getOptions(gid) ?? { trackType: TrackType.both };
      return downloadGroup(gid, opts);
    }));
    await notify(NotificationKind.QueueDownloading, { n: group_ids.length.toString() }, fromShortcut);
  }

  function pauseAllGroups() {
    for (const groupId of groupStore.groupOrder) {
      const state = stateStore.getGroupState(groupId);
      if (state === MediaState.downloading || state === MediaState.downloadingList) {
        void pauseGroup(groupId);
      }
    }
  }

  function resumeAllGroups() {
    for (const groupId of groupStore.groupOrder) {
      const state = stateStore.getGroupState(groupId);
      if (state !== MediaState.paused && state !== MediaState.pausedList) continue;
      const options = optionsStore.getOptions(groupId);
      if (!options) {
        console.warn(`No options found for group: ${groupId}, cannot resume.`);
        continue;
      }
      void downloadGroup(groupId, options);
    }
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
    for (const groupId of [...groupStore.groupOrder]) {
      deleteGroup(groupId);
    }
  }

  function deleteGroupsByState(states: MediaState[]) {
    for (const groupId of [...groupStore.groupOrder]) {
      const state = stateStore.getGroupState(groupId);
      if (state && states.includes(state)) {
        deleteGroup(groupId);
      }
    }
  }

  return {
    processMediaAddPayload,
    finalizePlaylistGroup,
    dispatchMediaInfoFetch,
    downloadGroup,
    downloadAllGroups,
    pauseAllGroups,
    pauseGroup,
    resumeAllGroups,
    deleteGroup,
    deleteAllGroups,
    deleteGroupsByState,
  };
});
