import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DownloadOptions } from '../../tauri/types/media';
import { useMediaGroupStore } from './group';
import { Group } from '../../tauri/types/group';

export const useMediaOptionsStore = defineStore('media-options', () => {
  const groupOptions = ref<Record<string, DownloadOptions>>({});
  const globalOptions = ref<DownloadOptions>();

  const groupStore = useMediaGroupStore();

  const setOptions = (groupId: string, options: DownloadOptions) => {
    groupOptions.value[groupId] = options;
  };

  const getOptions = (groupId: string): DownloadOptions | undefined => {
    return groupOptions.value[groupId];
  };

  const getGlobalOptions = (): DownloadOptions | undefined => {
    return globalOptions.value;
  };

  const removeOptions = (groupId: string) => {
    delete groupOptions.value[groupId];
  };

  function applyOptionsToGroup(
    group: Group,
    options: DownloadOptions,
  ) {
    setOptions(group.id, options);
  }

  function applyGlobalOptions(
    options: DownloadOptions,
  ) {
    globalOptions.value = options;
    const groups = groupStore.groups;
    for (const group of Object.values(groups)) {
      applyOptionsToGroup(group, options);
    }
  }

  return {
    groupOptions,
    globalOptions,
    setOptions,
    getOptions,
    getGlobalOptions,
    removeOptions,
    applyGlobalOptions,
    applyOptionsToGroup,
  };
});
