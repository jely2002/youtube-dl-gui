import { describe, expect, it } from 'vitest';
import { withoutCredentials } from '../../src/sentry.ts';

const group = (url: string) => ({
  url,
  title: 'A video',
  total: 1,
  processed: 0,
  errored: 0,
  thumbnail: url.replace('master.m3u8', 'thumb.jpg'),
  entries: [{ index: 0, videoUrl: url }],
  items: { item: { id: 'item', url, formats: [{ id: 'f', url }] }, pending: { id: 'pending', url: null } },
});

describe('withoutCredentials', () => {
  it('removes sign-in details from the state attached to error reports', () => {
    const states = {
      'media-options': {
        groupOptions: { a: { trackType: 'both' } },
        groupOverrides: {
          a: {
            auth: { cookieFile: '/tmp/cookies.txt', extraHeaders: ['Authorization: Bearer secret'], bearerToken: 'secret' },
            network: { proxy: 'http://proxy.test' },
            title: 'A video',
          },
          b: { output: { addMetadata: true } },
        },
      },
      'media-group': {
        groups: {
          a: group('https://cdn.test/master.m3u8?token=secret#t=1'),
          b: group('https://example.com/watch?v=abc'),
        },
        groupOrder: ['a', 'b'],
      },
      'other-store': { value: 1 },
    };
    const before = structuredClone(states);

    const scrubbed = withoutCredentials(states);

    expect(JSON.stringify(scrubbed)).not.toContain('secret');
    expect(JSON.stringify(scrubbed)).not.toContain('cookies.txt');
    expect(scrubbed).toEqual({
      'media-options': {
        groupOptions: { a: { trackType: 'both' } },
        groupOverrides: {
          a: { auth: '[redacted]', network: { proxy: 'http://proxy.test' }, title: 'A video' },
          b: { output: { addMetadata: true } },
        },
      },
      'media-group': {
        groups: {
          // The item with its own sign-in is reduced to a summary, its address without the
          // part that can hold a token...
          a: {
            url: 'https://cdn.test/master.m3u8',
            title: 'A video',
            total: 1,
            processed: 0,
            errored: 0,
            details: expect.any(String),
          },
          // ...and an ordinary link is reported as before.
          b: group('https://example.com/watch?v=abc'),
        },
        groupOrder: ['a', 'b'],
      },
      'other-store': { value: 1 },
    });
    // The live store state is left untouched.
    expect(states).toEqual(before);
  });

  it('attaches nothing rather than unscrubbed state when it cannot do its job', () => {
    const broken = {
      'media-options': {
        get groupOverrides(): Record<string, unknown> {
          throw new Error('unexpected shape');
        },
      },
    };
    const result = withoutCredentials(broken);
    expect(result).toEqual({ omitted: expect.any(String) });
  });

  it('passes state through when there is nothing to remove', () => {
    const states = {
      'media-options': { groupOverrides: { b: { output: { addMetadata: true } } } },
      'media-group': { groups: { b: group('https://example.com/watch?v=abc') } },
    };
    expect(withoutCredentials(states)).toBe(states);
    const other = { 'other-store': { value: 1 } };
    expect(withoutCredentials(other)).toBe(other);
  });
});
