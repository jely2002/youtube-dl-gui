import { describe, expect, it } from 'vitest';
import { uniqueTitle } from '../../src/helpers/groups.ts';

describe('uniqueTitle', () => {
  const queue = [
    { title: 'Show', url: 'https://cdn.test/a/master.m3u8?token=1' },
    { title: 'Show (2)', url: 'https://cdn.test/b/master.m3u8' },
    { title: 'Other', url: 'https://cdn.test/c/master.m3u8' },
    { url: 'https://cdn.test/d/master.m3u8' },
  ];

  it('keeps a title nothing else has', () => {
    expect(uniqueTitle('New', 'https://cdn.test/e/master.m3u8', queue)).toBe('New');
    expect(uniqueTitle('Show', 'https://cdn.test/e/master.m3u8', [])).toBe('Show');
  });

  it('numbers a title another item already has', () => {
    expect(uniqueTitle('Show', 'https://cdn.test/e/master.m3u8', queue)).toBe('Show (3)');
    expect(uniqueTitle('Other', 'https://cdn.test/e/master.m3u8', queue)).toBe('Other (2)');
  });

  it('gives the very same address the same title again', () => {
    expect(uniqueTitle('Show', 'https://cdn.test/a/master.m3u8?token=1', queue)).toBe('Show');
    // The second stream of that page was numbered the first time, and is numbered the same now.
    expect(uniqueTitle('Show', 'https://cdn.test/b/master.m3u8', queue)).toBe('Show (2)');
  });

  it('numbers an address that differs only in its query: it may be another video', () => {
    expect(uniqueTitle('Show', 'https://cdn.test/a/master.m3u8?token=2', queue)).toBe('Show (3)');
    expect(uniqueTitle('Clip', 'https://a.test/play.m3u8?id=2', [{ title: 'Clip', url: 'https://a.test/play.m3u8?id=1' }])).toBe('Clip (2)');
  });
});
