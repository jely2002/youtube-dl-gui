import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useMediaGroupStore } from './group';

export const enum MediaState {
  fetching = 'fetching',
  fetchingList = 'fetchingList',
  configure = 'configure',
  downloading = 'downloading',
  downloadingList = 'downloadingList',
  error = 'error',
  done = 'done',
}

export const useMediaStateStore = defineStore('media-state', () => {
  const itemStates = ref<Record<string, MediaState>>({});

  const setState = (id: string, state: MediaState) => {
    itemStates.value[id] = state;
  };

  const getState = (id: string): MediaState | undefined => {
    return itemStates.value[id];
  };

  const groupStore = useMediaGroupStore();

  const setGroupState = (groupId: string, state: MediaState) => {
    const leader = groupStore.findGroupLeader(groupId);
    if (!leader) return;
    setState(
      leader.id,
      state,
    );
  };

  const getGroupState = (groupId: string): MediaState | undefined => {
    const leader = groupStore.findGroupLeader(groupId);
    if (!leader) return;
    return getState(leader.id);
  };

  const removeState = (id: string) => {
    delete itemStates.value[id];
  };

  return { itemStates, setState, getState, setGroupState, getGroupState, removeState };
});
