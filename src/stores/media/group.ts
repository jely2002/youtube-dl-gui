import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../../tauri/types/group';
import { MediaFormat } from '../../tauri/types/media';
import { firstKey, omit } from '../../helpers/groups';

export const useMediaGroupStore = defineStore('media-group', () => {
  const groups = ref<Record<string, Group>>({});
  const groupOrder = ref<string[]>([]);

  const orderedGroups = computed(() =>
    groupOrder.value
      .map(id => groups.value[id])
      .filter((group): group is Group => !!group),
  );

  const findGroupById = (id: string) => groups.value[id];

  const findItemInGroup = (groupId: string, itemId: string) =>
    groups.value[groupId]?.items[itemId];

  const findGroupByItemId = (itemId: string) =>
    Object.values(groups.value).find(g => itemId in g.items);

  const findGroupLeader = (groupId: string) => {
    const group = groups.value[groupId];
    if (!group) return;
    return Object.values(group.items).find(item => item.isLeader);
  };

  const prependGroups = (newGroups: Group[]) => {
    if (newGroups.length === 0) return;
    const ids = newGroups.map(group => group.id);
    const idSet = new Set(ids);

    for (const group of newGroups) {
      groups.value[group.id] = group;
    }

    groupOrder.value = [
      ...ids,
      ...groupOrder.value.filter(id => !idSet.has(id)),
    ];
  };

  const createGroup = (group: Group) => {
    prependGroups([group]);
  };

  const deleteGroup = (id: string) => {
    delete groups.value[id];
    const index = groupOrder.value.indexOf(id);
    if (index !== -1) groupOrder.value.splice(index, 1);
  };

  const cancelGroup = (id: string) => {
    void invoke('group_cancel', { groupId: id });
  };

  function splitGroup(group: Group): Group[] {
    const result: Group[] = [];

    const leader = Object.values(group.items).find(item => item.entries);
    const entries = leader?.entries;

    if (!entries) return result;

    const entryByUrl = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      entryByUrl.set(entry.videoUrl, entry);
    }

    const orderedGroups: (Group | undefined)[] = new Array(entries.length);
    const extras: Group[] = [];

    for (const [itemKey, item] of Object.entries(group.items)) {
      if (item.entries) continue;

      const entry = entryByUrl.get(item.url);
      const meta = omit(item, ['id', 'groupId', 'isLeader']);

      const newGroup: Group = {
        id: uuidv4(),
        total: 1,
        processed: 1,
        errored: 0,
        isCombined: false,
        ...meta,
        items: {
          [itemKey]: { ...item, isLeader: true },
        },
      };

      if (entry) {
        newGroup.playlistCount = leader?.playlistCount;
        newGroup.playlistUploader = leader?.uploader;
        newGroup.playlistUploaderId = leader?.uploaderId;
        newGroup.playlistTitle = leader?.title;
        newGroup.playlistId = leader?.playlistId;
        newGroup.items[itemKey].playlistIndex = entry.index;
        orderedGroups[entry.index] = newGroup;
      } else {
        extras.push(newGroup);
      }
    }

    const finalGroups = orderedGroups.filter(
      (g): g is Group => g !== undefined,
    ).concat(extras);

    prependGroups(finalGroups);

    deleteGroup(group.id);

    return finalGroups;
  }

  /**
   * Finds the first-added item in a group, merges
   * all audioCodecs + formats into it, dedupes by id,
   * and copies merged meta back onto the group.
   */
  function consolidateGroup(group: Group) {
    group.isCombined = true;

    const leaderKey = firstKey(group.items);
    if (!leaderKey) return;

    const leader = group.items[leaderKey];
    const items = Object.values(group.items);

    leader.duration = items.reduce((sum, { duration }) => sum + (duration ?? 0), 0);

    const codecSet = new Set<string>();
    for (const it of items) {
      const entry = leader.entries?.find(entry => entry.videoUrl === it.url);
      if (entry) it.playlistIndex = entry.index;
      for (const codec of it.audioCodecs ?? []) codecSet.add(codec);
    }
    leader.audioCodecs = [...codecSet];

    const formatMap = new Map<string, MediaFormat>();
    for (const it of items) {
      for (const f of it.formats ?? []) {
        const key = `${f.height}p${f.fps ?? ''}`;
        if (!formatMap.has(key)) formatMap.set(key, f);
      }
    }
    leader.formats = [...formatMap.values()];

    group.playlistTitle = leader.title;
    const leaderMeta = omit(leader, ['id', 'groupId', 'isLeader']);
    Object.assign(group, leaderMeta);
  }

  const countGroups = () => groupOrder.value.length;

  function getAllFormats() {
    const formatMap = new Map<string, MediaFormat>();
    for (const group of Object.values(groups.value)) {
      for (const item of Object.values(group.items)) {
        for (const format of item.formats ?? []) {
          const key = `${format.height}p${format.fps ?? ''}`;
          if (!formatMap.has(key)) formatMap.set(key, format);
        }
      }
    }
    return [...formatMap.values()];
  }

  return {
    groups,
    groupOrder,
    orderedGroups,
    countGroups,
    findGroupById,
    findItemInGroup,
    findGroupByItemId,
    findGroupLeader,
    createGroup,
    prependGroups,
    cancelGroup,
    deleteGroup,
    splitGroup,
    consolidateGroup,
    getAllFormats,
  };
});
