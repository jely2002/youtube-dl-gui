import { describe, it, expect, beforeEach } from 'vitest';
import { saveGroup, removeGroup, getAllGroups } from '../../src/stores/media/idb';

describe('IndexedDB media group store', () => {
  // Use unique database names to avoid state leakage between tests
  let testDbName: string;

  beforeEach(() => {
    testDbName = `media-store-test-${Date.now()}-${Math.random()}`;
  });

  it('saves and retrieves a group', async () => {
    const group = {
      id: 'test-group-1',
      url: 'https://example.com/video',
      total: 1,
      processed: 1,
      errored: 0,
      isCombined: false,
      audioCodecs: ['opus'],
      videoCodecs: ['vp9'],
      audioTracks: [],
      videoTracks: [],
      formats: [],
      filesize: 1024,
      items: {
        'item-1': {
          id: 'item-1',
          isLeader: true,
          url: 'https://example.com/video',
          audioCodecs: ['opus'],
          videoCodecs: ['vp9'],
          audioTracks: [],
          videoTracks: [],
          formats: [],
          filesize: 1024,
        },
      },
    };

    await saveGroup('test-group-1', group, testDbName);
    const groups = await getAllGroups(testDbName);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(group);
  });

  it('saves multiple groups and retrieves all', async () => {
    const group1 = { id: 'g1', name: 'Group 1', items: { i1: { id: 'i1' } } };
    const group2 = { id: 'g2', name: 'Group 2', items: { i2: { id: 'i2' } } };

    await saveGroup('g1', group1, testDbName);
    await saveGroup('g2', group2, testDbName);

    const groups = await getAllGroups(testDbName);

    expect(groups).toHaveLength(2);
    expect(groups.find(g => (g as any).id === 'g1')).toEqual(group1);
    expect(groups.find(g => (g as any).id === 'g2')).toEqual(group2);
  });

  it('removes a group', async () => {
    const group = { id: 'to-remove', name: 'Remove Me', items: {} };
    await saveGroup('to-remove', group, testDbName);

    await removeGroup('to-remove', testDbName);
    const groups = await getAllGroups(testDbName);

    expect(groups).toHaveLength(0);
  });

  it('handles Vue reactive objects without throwing DataCloneError', async () => {
    const reactiveGroup = {
      id: 'reactive-test',
      url: 'https://example.com',
      total: 2,
      processed: 2,
      errored: 0,
      isCombined: true,
      audioCodecs: ['aac'],
      videoCodecs: ['h264'],
      audioTracks: [],
      videoTracks: [],
      formats: [
        { id: 'f1', height: 720, fps: 30, audioCodecs: [], videoCodecs: [] },
        { id: 'f2', height: 1080, fps: 60, audioCodecs: [], videoCodecs: [] },
      ],
      filesize: 2048,
      items: {
        item1: {
          id: 'item1',
          isLeader: true,
          url: 'https://example.com',
          audioCodecs: ['aac'],
          videoCodecs: ['h264'],
          audioTracks: [],
          videoTracks: [],
          formats: [],
          filesize: 1024,
        },
        item2: {
          id: 'item2',
          isLeader: false,
          url: 'https://example.com/2',
          audioCodecs: ['aac'],
          videoCodecs: ['h264'],
          audioTracks: [],
          videoTracks: [],
          formats: [],
          filesize: 1024,
        },
      },
    };

    await expect(saveGroup('reactive-test', reactiveGroup, testDbName)).resolves.not.toThrow();

    const groups = await getAllGroups(testDbName);
    expect(groups).toHaveLength(1);
    expect((groups[0] as any).id).toBe('reactive-test');
  });

  it('handles objects with undefined values (which structuredClone would reject)', async () => {
    const groupWithUndefined = {
      id: 'undefined-test',
      name: 'Test',
      optionalField: undefined,
      nested: {
        alsoUndefined: undefined,
        valid: 'value',
      },
      items: {},
    };

    await expect(saveGroup('undefined-test', groupWithUndefined, testDbName)).resolves.not.toThrow();

    const groups = await getAllGroups(testDbName);
    expect(groups).toHaveLength(1);
    expect((groups[0] as any).optionalField).toBeUndefined();
    expect((groups[0] as any).nested.alsoUndefined).toBeUndefined();
    expect((groups[0] as any).nested.valid).toBe('value');
  });

  it('updates an existing group', async () => {
    const original = { id: 'update-test', version: 1, items: {} };
    await saveGroup('update-test', original, testDbName);

    const updated = { id: 'update-test', version: 2, items: { newItem: { id: 'new' } } };
    await saveGroup('update-test', updated, testDbName);

    const groups = await getAllGroups(testDbName);
    expect(groups).toHaveLength(1);
    expect((groups[0] as any).version).toBe(2);
    expect((groups[0] as any).items.newItem).toEqual({ id: 'new' });
  });
});
