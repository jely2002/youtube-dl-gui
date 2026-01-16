import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useMediaGroupStore } from './group';
import { MediaState, useMediaStateStore } from './state';
import {
  MediaGroupProgressPayload,
  MediaItemsProgress,
  MediaProgressCompletePayload,
  MediaProgressPayload,
  MediaProgressStagePayload,
  ProgressCategory,
  ProgressStage,
} from '../../tauri/types/progress';
import { notifyGroup } from '../../tauri/notifications';
import { NotificationKind } from '../../tauri/types/app';

export type MediaProgress = MediaProgressPayload & MediaProgressStagePayload;
export type MediaGroupProgress = MediaGroupProgressPayload & MediaProgressStagePayload;

export const useMediaProgressStore = defineStore('media-progress', () => {
  const progress = ref<Record<string, MediaProgress>>({});
  const groupStore = useMediaGroupStore();
  const stateStore = useMediaStateStore();

  function processMediaProgressPayload(payload: MediaProgressPayload) {
    const existing = progress.value[payload.id];
    if (existing) {
      Object.assign(existing, {
        ...payload,
        percentage: payload.percentage ?? existing.percentage,
        etaSecs: payload.etaSecs ?? existing.etaSecs,
        speedBps: payload.speedBps ?? existing.speedBps,
        stage: existing.stage ?? ProgressStage.initializing,
      });
    } else {
      progress.value[payload.id] = {
        ...payload,
        stage: ProgressStage.initializing,
      } as MediaProgress;
    }
  }

  function processMediaProgressStagePayload(payload: MediaProgressStagePayload) {
    const existing = progress.value[payload.id];
    if (existing) {
      existing.stage = payload.stage;
    } else {
      progress.value[payload.id] = {
        ...payload,
        category: ProgressCategory.other,
      } as MediaProgress;
    }
  }

  function processMediaCompletePayload(payload: MediaProgressCompletePayload) {
    stateStore.setState(payload.id, MediaState.done);
    const group = groupStore.findGroupById(payload.groupId);
    if (group.isCombined) {
      const items = Object.values(group.items);
      const isDone = !items.some(p => stateStore.getState(p.id) !== MediaState.done && !p.isLeader);
      if (isDone) {
        void notifyGroup(NotificationKind.PlaylistFinished, group, {}, items.length);
        stateStore.setGroupState(group.id, MediaState.done);
      }
    } else {
      void notifyGroup(NotificationKind.VideoFinished, group);
    }
  }

  function findGroupProgress(groupId: string): MediaGroupProgress | undefined {
    const group = groupStore.findGroupById(groupId);
    if (!group) return;

    const itemIds = Object.values(group.items)
      .filter(item => !group.isCombined || !item.isLeader)
      .map(i => i.id);
    if (itemIds.length === 0) return;

    const itemsProgress = itemIds
      .map(id => progress.value[id])
      .filter((p): p is MediaProgress => !!p);

    const speedBps = itemsProgress.reduce((sum, p) => sum + (p.speedBps ?? 0), 0);
    const done = itemIds.filter(id => stateStore.getState(id) === MediaState.done).length;
    const downloading = itemIds.filter(id => stateStore.getState(id) === MediaState.downloading || stateStore.getState(id) === MediaState.downloadingList).length;
    let ready = itemIds.filter(id => stateStore.getState(id) === MediaState.configure).length;
    const total = downloading > 0 ? downloading + done : ready + done;

    // If we are fetching metadata for a group of multiple items (playlist).
    // Ensure we only show the amount of ready items once we are done fetching the entire playlist.
    if (Object.keys(group.items).length > 1 && downloading === 0 && !group.isCombined) {
      ready = 0;
    }

    return {
      id: groupId,
      groupId,
      stage: ProgressStage.downloading,
      speedBps,
      ready,
      total,
      done,
      downloading,
    };
  }

  function findAllProgress(): Required<MediaItemsProgress> {
    const groups = groupStore.groups;
    const groupIds = Object.keys(groups);

    const progress: Required<MediaItemsProgress> = {
      total: 0,
      done: 0,
      ready: 0,
      downloading: 0,
    };
    let hasDownloading = false;
    for (const groupId of groupIds) {
      const groupProgress = findGroupProgress(groupId);
      if (groupProgress) {
        progress.ready += groupProgress.ready ?? 0;
        progress.done += groupProgress.done ?? 0;
        progress.downloading += groupProgress.downloading ?? 0;
        if ((groupProgress.downloading ?? 0) > 0) {
          hasDownloading = true;
        }
      }
    }
    progress.total = hasDownloading ? progress.downloading + progress.done : progress.ready + progress.done;
    return progress;
  }

  function findDownloadProgress(groupId: string): MediaProgress | undefined {
    const group = groupStore.findGroupById(groupId);
    if (!group) return;
    const firstId = Object.keys(group.items)[0];
    if (!firstId) return;
    return progress.value[firstId];
  }

  function deleteProgress(id: string) {
    delete progress.value[id];
  }

  return {
    progress,
    processMediaProgressPayload,
    processMediaProgressStagePayload,
    processMediaCompletePayload,
    findGroupProgress,
    findDownloadProgress,
    findAllProgress,
    deleteProgress,
  };
});
