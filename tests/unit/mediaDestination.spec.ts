import { describe, it, expect } from 'vitest';
import { useMediaDestinationStore } from '../../src/stores/media/destination';

describe('media destination store', () => {
  it('stores and retrieves destinations for groups', () => {
    const store = useMediaDestinationStore();
    const destinations = [
      { confidence: 50, path: '/tmp/file1' },
      { confidence: 50, path: '/tmp/file2' },
    ];
    for (const dest of destinations) {
      store.addDestination('g1', dest);
    }
    expect(store.getDestinations('g1')).toEqual(destinations);
    store.deleteDestinations('g1');
    expect(store.getDestinations('g1')).toEqual([]);
  });

  it('retrieves the primary destination based on confidence', () => {
    const store = useMediaDestinationStore();
    const destinations = [
      { confidence: 20, path: '/tmp/file1' },
      { confidence: 90, path: '/tmp/file2' },
      { confidence: 70, path: '/tmp/file3' },
    ];
    for (const dest of destinations) {
      store.addDestination('g1', dest);
    }
    expect(store.getPrimaryDestination('g1')).toEqual(destinations[1]);
  });
});
