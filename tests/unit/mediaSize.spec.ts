import { describe, expect, it } from 'vitest';
import { installTauriMock } from '../utils/tauriMock.ts';
import { useMediaSizeStore } from '../../src/stores/media/size.ts';
import { TrackType } from '../../src/tauri/types/media';

describe('media size store', () => {
  it('asks for the size with the overrides the item will be downloaded with', async () => {
    const calls: Array<Record<string, unknown>> = [];
    installTauriMock({
      media_size: (_cmd, args) => {
        calls.push(args as Record<string, unknown>);
        return null;
      },
    });

    const overrides = { auth: { cookieFile: '/tmp/cookies.txt', headers: ['Referer: https://example.com/'] } };
    await useMediaSizeStore().requestSize(
      'https://example.com/master.m3u8',
      'group-1',
      'item-1',
      { trackType: TrackType.both },
      overrides,
    );

    expect(calls).toEqual([{
      url: 'https://example.com/master.m3u8',
      groupId: 'group-1',
      id: 'item-1',
      format: { trackType: 'both' },
      overrides,
    }]);
  });
});
