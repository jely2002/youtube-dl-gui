import { describe, expect, it, vi } from 'vitest';
import { useMediaGroupStore } from '../../src/stores/media/group';
import { useMediaStateStore, MediaState } from '../../src/stores/media/state';
import { useMediaProgressStore } from '../../src/stores/media/progress';
import { useMediaDiagnosticsStore } from '../../src/stores/media/diagnostics';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('media progress store', () => {
  it('tracks ready and downloading items separately', () => {
    const groupStore = useMediaGroupStore();
    const stateStore = useMediaStateStore();
    const progressStore = useMediaProgressStore();

    groupStore.createGroup({
      id: 'g1',
      url: 'g1',
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
      url: 'g1',
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
      url: 'g2',
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

  it('marks combined playlists done after mixed terminal outcomes', () => {
    const groupStore = useMediaGroupStore();
    const stateStore = useMediaStateStore();
    const progressStore = useMediaProgressStore();
    const diagnosticsStore = useMediaDiagnosticsStore();

    groupStore.createGroup({
      id: 'g-mixed',
      url: 'g-mixed',
      total: 3,
      processed: 3,
      errored: 0,
      isCombined: true,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        leader: { id: 'leader', url: 'leader', title: 'Leader', audioCodecs: [], formats: [], filesize: 0, isLeader: true, entries: [] },
        a: { id: 'a', url: 'a', title: 'A', audioCodecs: [], formats: [], filesize: 0 },
        b: { id: 'b', url: 'b', title: 'B', audioCodecs: [], formats: [], filesize: 0 },
      },
    });

    stateStore.setGroupState('g-mixed', MediaState.downloadingList);
    stateStore.setState('a', MediaState.downloading);
    stateStore.setState('b', MediaState.downloading);

    diagnosticsStore.processMediaFatalPayload({
      id: 'a',
      groupId: 'g-mixed',
      exitCode: 1,
      internal: true,
      message: 'failed',
      details: null,
      timestamp: Date.now(),
    });

    expect(stateStore.getGroupState('g-mixed')).toBe(MediaState.downloadingList);

    progressStore.processMediaCompletePayload({
      id: 'b',
      groupId: 'g-mixed',
    });

    expect(stateStore.getGroupState('g-mixed')).toBe(MediaState.done);

    const progress = progressStore.findGroupProgress('g-mixed');
    expect(progress?.done).toBe(2);
    expect(progress?.downloading).toBe(0);
    expect(progress?.total).toBe(2);
  });

  it('keeps playlist fetch groups in fetchingList when one item metadata fetch fails', () => {
    const groupStore = useMediaGroupStore();
    const stateStore = useMediaStateStore();
    const diagnosticsStore = useMediaDiagnosticsStore();

    groupStore.createGroup({
      id: 'g-fetch',
      url: 'g-fetch',
      total: 3,
      processed: 1,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        leader: { id: 'leader-fetch', url: 'leader-fetch', title: 'Leader', audioCodecs: [], formats: [], filesize: 0, isLeader: true, entries: [] },
      },
    });

    stateStore.setGroupState('g-fetch', MediaState.fetchingList);

    diagnosticsStore.processMediaFatalPayload({
      id: 'failed-fetch-item',
      groupId: 'g-fetch',
      exitCode: 1,
      internal: true,
      message: 'failed',
      details: null,
      timestamp: Date.now(),
    });

    expect(stateStore.getGroupState('g-fetch')).toBe(MediaState.fetchingList);
  });

  it('marks combined playlists error when every item fails', () => {
    const groupStore = useMediaGroupStore();
    const stateStore = useMediaStateStore();
    const diagnosticsStore = useMediaDiagnosticsStore();

    groupStore.createGroup({
      id: 'g-failed',
      url: 'g-failed',
      total: 3,
      processed: 3,
      errored: 0,
      isCombined: true,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        leader: { id: 'leader-failed', url: 'leader-failed', title: 'Leader', audioCodecs: [], formats: [], filesize: 0, isLeader: true, entries: [] },
        a: { id: 'failed-a', url: 'failed-a', title: 'A', audioCodecs: [], formats: [], filesize: 0 },
        b: { id: 'failed-b', url: 'failed-b', title: 'B', audioCodecs: [], formats: [], filesize: 0 },
      },
    });

    stateStore.setGroupState('g-failed', MediaState.downloadingList);
    stateStore.setState('failed-a', MediaState.downloading);
    stateStore.setState('failed-b', MediaState.downloading);

    diagnosticsStore.processMediaFatalPayload({
      id: 'failed-a',
      groupId: 'g-failed',
      exitCode: 1,
      internal: true,
      message: 'failed',
      details: null,
      timestamp: Date.now(),
    });

    expect(stateStore.getGroupState('g-failed')).toBe(MediaState.downloadingList);

    diagnosticsStore.processMediaFatalPayload({
      id: 'failed-b',
      groupId: 'g-failed',
      exitCode: 1,
      internal: true,
      message: 'failed',
      details: null,
      timestamp: Date.now(),
    });

    expect(stateStore.getGroupState('g-failed')).toBe(MediaState.error);
  });
});
