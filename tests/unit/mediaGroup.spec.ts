import { describe, it, expect } from 'vitest';
import { useMediaGroupStore } from '../../src/stores/media/group';
import { MediaItem } from '../../src/tauri/types/media';
import { Group } from '../../src/tauri/types/group.ts';

function createItem(id: string, extra: Partial<MediaItem> = {}): MediaItem {
  return {
    id,
    url: id,
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
      url: 'g1',
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
      url: 'g2',
      total: 2,
      processed: 2,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        a: { ...createItem('a'), entries: [{ videoUrl: 'b', index: 0 }, { videoUrl: 'c', index: 1 }] },
        b: createItem('b'),
        c: createItem('c'),
      },
    };
    store.createGroup(group);
    const result = store.splitGroup(group);
    expect(result).toHaveLength(2);
    expect(store.findGroupById(group.id)).toBeUndefined();
    const itemIds = result.map(g => Object.keys(g.items)[0]).sort();
    expect(itemIds).toEqual(['b', 'c']);
    result.forEach((g) => {
      const item = Object.values(g.items)[0];
      expect(item.isLeader).toBe(true);
    });
  });

  it('returns empty array and keeps the group when there is no entries item', () => {
    const store = useMediaGroupStore();
    const group: Group = {
      id: 'g-no-entries',
      url: 'g-no-entries',
      total: 2,
      processed: 0,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        a: createItem('a'),
        b: createItem('b'),
      },
    };

    store.createGroup(group);

    const result = store.splitGroup(group);

    expect(result).toHaveLength(0);
    expect(store.findGroupById(group.id)).toBeDefined();
  });

  it('orders split groups according to entries index', () => {
    const store = useMediaGroupStore();
    const group: Group = {
      id: 'g-order',
      url: 'g-order',
      total: 2,
      processed: 2,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        a: {
          ...createItem('a'),
          entries: [
            { videoUrl: 'c', index: 1 },
            { videoUrl: 'b', index: 0 },
          ],
        },
        b: createItem('b'),
        c: createItem('c'),
      },
    };

    store.createGroup(group);
    const result = store.splitGroup(group);

    expect(result).toHaveLength(2);
    expect(store.findGroupById(group.id)).toBeUndefined();

    const itemIdsInOrder = result.map(g => Object.keys(g.items)[0]);
    expect(itemIdsInOrder).toEqual(['b', 'c']);
  });

  it('puts items without matching entry at the end', () => {
    const store = useMediaGroupStore();
    const group: Group = {
      id: 'g-extras',
      url: 'g-extras',
      total: 3,
      processed: 3,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        a: {
          ...createItem('a'),
          entries: [
            { videoUrl: 'b', index: 0 },
          ],
        },
        b: createItem('b'),
        c: createItem('c'),
        d: createItem('d'),
      },
    };

    store.createGroup(group);
    const result = store.splitGroup(group);

    expect(result).toHaveLength(3);
    expect(store.findGroupById(group.id)).toBeUndefined();

    const itemIdsInOrder = result.map(g => Object.keys(g.items)[0]);
    expect(itemIdsInOrder).toEqual(['b', 'c', 'd']);

    for (const g of result) {
      const item = Object.values(g.items)[0];
      expect(item.isLeader).toBe(true);
      expect(g.total).toBe(1);
      expect(g.processed).toBe(1);
      expect(g.errored).toBe(0);
      expect(g.isCombined).toBe(false);
      expect(g.id).not.toBe(group.id);
    }
  });
});
