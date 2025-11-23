import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../../tauri/types/group';
import { MediaFormat } from '../../tauri/types/media';
import { firstKey, omit } from '../../helpers/groups';

export const useMediaGroupStore = defineStore('media-group', () => {
  const groups = ref<Record<string, Group>>({});

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

  const createGroup = (group: Group) => {
    groups.value[group.id] = group;
  };

  const deleteGroup = (id: string) => {
    delete groups.value[id];
  };

  const cancelGroup = (id: string) => {
    void invoke('group_cancel', { groupId: id });
  };

  function splitGroup(group: Group): Group[] {
    const result: Group[] = [];

    for (const [itemKey, item] of Object.entries(group.items)) {
      if (item.entries) continue;

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

      createGroup(newGroup);
      result.push(newGroup);
    }

    deleteGroup(group.id);
    return result;
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

    const leaderMeta = omit(leader, ['id', 'groupId', 'isLeader']);
    Object.assign(group, leaderMeta);
  }

  const countGroups = () => Object.keys(groups.value).length;

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
    countGroups,
    findGroupById,
    findItemInGroup,
    findGroupByItemId,
    findGroupLeader,
    createGroup,
    cancelGroup,
    deleteGroup,
    splitGroup,
    consolidateGroup,
    getAllFormats,
  };
});
