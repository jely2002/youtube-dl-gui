import { describe, it, expect } from 'vitest';
import { useMediaGroupStore } from '../../src/stores/media/group';
import { MediaItem } from '../../src/tauri/types/media';
import { Group } from '../../src/tauri/types/group.ts';

function createItem(id: string, extra: Partial<MediaItem> = {}): MediaItem {
  return {
    id,
    audioCodecs: [],
    formats: [],
    filesize: 0,
    ...extra,
  };
}

describe('media group store', () => {
  it('consolidates items into the leader when combining', () => {
    const store = useMediaGroupStore();
    const group: Group = {
      id: 'g1',
      total: 2,
      processed: 2,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        a: { ...createItem('a'), isLeader: true, audioCodecs: ['a1'], formats: [{ id: 'f1', height: 720, videoCodecs: [], fps: 30 }] },
        b: { ...createItem('b'), audioCodecs: ['a2'], formats: [{ id: 'f2', height: 1080, videoCodecs: [], fps: 60 }] },
      },
    };
    store.createGroup(group);

    store.consolidateGroup(group);

    expect(group.isCombined).toBe(true);
    const leader = Object.values(group.items)[0];
    expect(leader.audioCodecs).toContain('a1');
    expect(leader.audioCodecs).toContain('a2');
    expect(leader.formats.length).toBe(2);
  });

  it('splits a group into individual groups', () => {
    const store = useMediaGroupStore();
    const group: Group = {
      id: 'g2',
      total: 2,
      processed: 2,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        a: { ...createItem('a'), isLeader: true },
        b: createItem('b'),
      },
    };
    store.createGroup(group);
    const result = store.splitGroup(group);
    expect(result).toHaveLength(2);
    expect(store.findGroupById(group.id)).toBeUndefined();
    const itemIds = result.map(g => Object.keys(g.items)[0]).sort();
    expect(itemIds).toEqual(['a', 'b']);
    result.forEach((g) => {
      const item = Object.values(g.items)[0];
      expect(item.isLeader).toBe(true);
    });
  });
});
