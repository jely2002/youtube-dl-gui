import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DownloadOptions, EncodingOptions, TrackOptions } from '../../tauri/types/media';
import { useMediaGroupStore } from './group';
import { Group } from '../../tauri/types/group';

export const useMediaOptionsStore = defineStore('media-options', () => {
  const groupOptions = ref<Record<string, DownloadOptions>>({});
  const groupEncodings = ref<Record<string, EncodingOptions>>({});
  const groupTracks = ref<Record<string, TrackOptions>>({});
  const globalOptions = ref<DownloadOptions>();
  const globalEncodings = ref<EncodingOptions>();
  const globalTracks = ref<TrackOptions>();

  const groupStore = useMediaGroupStore();

  function setGroupValue<T>(target: { value: Record<string, T> }, groupId: string, value: T) {
    target.value[groupId] = value;
  }

  function getGroupValue<T>(target: { value: Record<string, T> }, groupId: string): T | undefined {
    return target.value[groupId];
  }

  function removeGroupValue<T>(target: { value: Record<string, T> }, groupId: string) {
    delete target.value[groupId];
  }

  function applyGlobalValue<T>(
    globalRef: { value: T | undefined },
    groupRef: { value: Record<string, T> },
    value: T,
  ) {
    globalRef.value = value;
    for (const group of Object.values(groupStore.groups)) {
      groupRef.value[group.id] = value;
    }
  }

  const setOptions = (groupId: string, options: DownloadOptions) => setGroupValue(groupOptions, groupId, options);
  const getOptions = (groupId: string): DownloadOptions | undefined => getGroupValue(groupOptions, groupId);
  const getGlobalOptions = (): DownloadOptions | undefined => globalOptions.value;

  const setEncodings = (groupId: string, encodings: EncodingOptions) => setGroupValue(groupEncodings, groupId, encodings);
  const getEncodings = (groupId: string): EncodingOptions | undefined => getGroupValue(groupEncodings, groupId);
  const getGlobalEncodings = (): EncodingOptions | undefined => globalEncodings.value;

  const setTracks = (groupId: string, tracks: TrackOptions) => setGroupValue(groupTracks, groupId, tracks);
  const getTracks = (groupId: string): TrackOptions | undefined => getGroupValue(groupTracks, groupId);
  const getGlobalTracks = (): TrackOptions | undefined => globalTracks.value;

  const removeOptions = (groupId: string) => {
    removeGroupValue(groupOptions, groupId);
    removeGroupValue(groupEncodings, groupId);
    removeGroupValue(groupTracks, groupId);
  };

  const removeEncodings = (groupId: string) => removeGroupValue(groupEncodings, groupId);
  const removeTracks = (groupId: string) => removeGroupValue(groupTracks, groupId);

  function applyOptionsToGroup(
    group: Group,
    options: DownloadOptions,
  ) {
    setOptions(group.id, options);
  }

  function applyEncodingsToGroup(
    group: Group,
    encodings: EncodingOptions,
  ) {
    setEncodings(group.id, encodings);
  }

  function applyTracksToGroup(
    group: Group,
    tracks: TrackOptions,
  ) {
    setTracks(group.id, tracks);
  }

  function applyGlobalOptions(
    options: DownloadOptions,
  ) {
    applyGlobalValue(globalOptions, groupOptions, options);
  }

  function applyGlobalEncodings(
    encodings: EncodingOptions,
  ) {
    applyGlobalValue(globalEncodings, groupEncodings, encodings);
  }

  function applyGlobalTracks(
    tracks: TrackOptions,
  ) {
    applyGlobalValue(globalTracks, groupTracks, tracks);
  }

  return {
    groupOptions,
    groupEncodings,
    groupTracks,
    globalOptions,
    globalEncodings,
    globalTracks,
    setOptions,
    getOptions,
    getGlobalOptions,
    setEncodings,
    getEncodings,
    getGlobalEncodings,
    setTracks,
    getTracks,
    getGlobalTracks,
    removeOptions,
    removeEncodings,
    removeTracks,
    applyGlobalOptions,
    applyGlobalEncodings,
    applyGlobalTracks,
    applyOptionsToGroup,
    applyEncodingsToGroup,
    applyTracksToGroup,
  };
});
