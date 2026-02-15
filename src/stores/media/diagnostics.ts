import { defineStore } from 'pinia';
import { ref } from 'vue';
import { MediaState, useMediaStateStore } from './state.ts';
import { useMediaGroupStore } from './group.ts';
import { notifyGroup } from '../../tauri/notifications';
import { NotificationKind } from '../../tauri/types/app';
import { useMediaStore } from './media.ts';

export const useMediaDiagnosticsStore = defineStore('media-diagnostics', () => {
  const diagnostics = ref<Record<string, MediaDiagnostic[]>>({});
  const fatals = ref<Record<string, MediaFatal>>({});

  const stateStore = useMediaStateStore();
  const groupStore = useMediaGroupStore();
  const mediaStore = useMediaStore();

  function processMediaDiagnosticPayload(payload: MediaDiagnostic) {
    diagnostics.value[payload.id] = diagnostics.value[payload.id] ?? [];
    diagnostics.value[payload.id].push(payload);
  }

  function processMediaFatalPayload(payload: MediaFatal) {
    fatals.value[payload.id] = payload;
    const { groupId } = payload;
    const group = groupStore.findGroupById(groupId);
    if (!group) throw new Error('Orphaned media item found during error handling.');
    group.processed++;
    group.errored++;
    if (group.processed === group.total && group.total > 1) {
      mediaStore.finalizePlaylistGroup(group);
    }
    const leader = groupStore.findGroupLeader(groupId);
    if (leader && leader.entries) {
      // We are combined, so we only set one item to error.
      stateStore.setState(payload.id, MediaState.error);
    } else {
      // We are not combined, so we set all items to error.
      stateStore.setGroupState(groupId, MediaState.error);
      void notifyGroup(NotificationKind.DownloadFailed, group, { message: payload.message });
    }
  }

  function findFatalsByGroupId(groupId: string): MediaFatal[] {
    const group = groupStore.findGroupById(groupId);
    if (!group) return [];
    return Object.values(fatals.value).reduce(
      (acc, fatal) => {
        if (fatal.groupId === group.id) {
          acc.push(fatal);
        }
        return acc;
      },
      [] as MediaFatal[],
    );
  }

  function findDiagnosticsByGroupId(groupId: string): MediaDiagnostic[] {
    const group = groupStore.findGroupById(groupId);
    if (!group) return [];
    return Object.values(diagnostics.value).reduce(
      (acc, items) => {
        if (items.some(i => i.groupId === group.id)) {
          acc.push(...items);
        }
        return acc;
      },
      [] as MediaDiagnostic[],
    );
  }

  function findLastFatalByGroupId(groupId: string): MediaFatal | undefined {
    const fatals = findFatalsByGroupId(groupId);
    return fatals[fatals.length - 1];
  }

  function findLastDiagnosticByGroupId(groupId: string): MediaDiagnostic | undefined {
    const diagnostics = findDiagnosticsByGroupId(groupId);
    return diagnostics[diagnostics.length - 1];
  }

  function removeDiagnostics(id: string) {
    delete diagnostics.value[id];
    delete fatals.value[id];
  }

  return { diagnostics, fatals, findLastFatalByGroupId, findLastDiagnosticByGroupId, findFatalsByGroupId, findDiagnosticsByGroupId, processMediaDiagnosticPayload, processMediaFatalPayload, removeDiagnostics };
});
