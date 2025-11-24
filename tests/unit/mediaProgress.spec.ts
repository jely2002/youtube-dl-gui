import { describe, expect, it } from 'vitest';
import { useMediaGroupStore } from '../../src/stores/media/group';
import { useMediaStateStore, MediaState } from '../../src/stores/media/state';
import { useMediaProgressStore } from '../../src/stores/media/progress';

describe('media progress store', () => {
  it('tracks ready and downloading items separately', () => {
    const groupStore = useMediaGroupStore();
    const stateStore = useMediaStateStore();
    const progressStore = useMediaProgressStore();

    groupStore.createGroup({
      id: 'g1',
      total: 2,
      processed: 2,
      errored: 0,
      isCombined: true,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        a: { id: 'a', url: 'a', title: 'A', audioCodecs: [], formats: [], filesize: 0, isLeader: true },
        b: { id: 'b', url: 'b', title: 'B', audioCodecs: [], formats: [], filesize: 0 },
      },
    });

    stateStore.setState('b', MediaState.configure);

    let progress = progressStore.findAllProgress();
    expect(progress.total).toBe(1);
    expect(progress.ready).toBe(1);
    expect(progress.downloading).toBe(0);

    stateStore.setState('b', MediaState.downloading);
    progress = progressStore.findAllProgress();
    expect(progress.downloading).toBe(1);
    expect(progress.ready).toBe(0);

    stateStore.setState('b', MediaState.done);
    progress = progressStore.findAllProgress();
    expect(progress.done).toBe(1);
    expect(progress.downloading).toBe(0);
  });

  it('excludes ready items from total when downloading', () => {
    const groupStore = useMediaGroupStore();
    const stateStore = useMediaStateStore();
    const progressStore = useMediaProgressStore();

    groupStore.createGroup({
      id: 'g1',
      total: 1,
      processed: 1,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: { a: { id: 'a', url: 'a', audioCodecs: [], formats: [], filesize: 0 } },
    });
    groupStore.createGroup({
      id: 'g2',
      total: 1,
      processed: 1,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: { b: { id: 'b', url: 'b', audioCodecs: [], formats: [], filesize: 0 } },
    });

    stateStore.setState('a', MediaState.downloading);
    stateStore.setState('b', MediaState.configure);

    const progress = progressStore.findAllProgress();
    expect(progress.total).toBe(1);
    expect(progress.downloading).toBe(1);
    expect(progress.ready).toBe(1);
  });
});
