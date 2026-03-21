import { describe, it, expect } from 'vitest';
import { useMediaOptionsStore } from '../../src/stores/media/options';
import { TrackType, MediaFormat } from '../../src/tauri/types/media';
import { useMediaGroupStore } from '../../src/stores/media/group';

describe('media options store', () => {
  it('stores and retrieves options for groups', () => {
    const store = useMediaOptionsStore();
    store.setOptions('g1', { trackType: TrackType.audio });
    expect(store.getOptions('g1')).toEqual({ trackType: TrackType.audio });
    store.removeOptions('g1');
    expect(store.getOptions('g1')).toBeUndefined();
  });

  it('applies global options to all groups', () => {
    const groupStore = useMediaGroupStore();
    const store = useMediaOptionsStore();
    const fmt720: MediaFormat = { id: '720', height: 720, fps: 30, videoCodecs: [] };
    const fmt480: MediaFormat = { id: '480', height: 480, fps: 30, videoCodecs: [] };

    groupStore.createGroup({
      id: 'g1',
      url: 'g1',
      total: 1,
      processed: 1,
      errored: 0,
      isCombined: true,
      audioCodecs: [],
      formats: [fmt720, fmt480],
      filesize: 0,
      urlHeaders: undefined,
      items: { a: { id: 'a', url: 'a', audioCodecs: [], formats: [fmt720, fmt480], filesize: 0, isLeader: true } },
    });
    groupStore.createGroup({
      id: 'g2',
      url: 'g2',
      total: 1,
      processed: 1,
      errored: 0,
      isCombined: true,
      audioCodecs: [],
      formats: [fmt720, fmt480],
      filesize: 0,
      urlHeaders: undefined,
      items: { b: { id: 'b', url: 'b', audioCodecs: [], formats: [fmt480], filesize: 0, isLeader: true } },
    });

    store.applyGlobalOptions({ trackType: TrackType.both, ...fmt720 });

    expect(store.getOptions('g1')).toEqual({ trackType: TrackType.both, ...fmt720 });
    expect(store.getOptions('g2')).toEqual({ trackType: TrackType.both, ...fmt720 });

    store.applyGlobalOptions({ trackType: TrackType.audio });
    expect(store.getOptions('g1')).toEqual({ trackType: TrackType.audio });
    expect(store.getOptions('g2')).toEqual({ trackType: TrackType.audio });
  });
});
