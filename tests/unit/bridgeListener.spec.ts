import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emit } from '@tauri-apps/api/event';
import { installTauriMock } from '../utils/tauriMock.ts';
import { BridgeMediaAddPayload, registerBridgeListeners } from '../../src/tauri/listeners/bridge.ts';

const { dispatchMediaInfoFetch, addUrlBatchAndDownload, groups } = vi.hoisted(() => ({
  dispatchMediaInfoFetch: vi.fn(),
  addUrlBatchAndDownload: vi.fn(),
  groups: {} as Record<string, { title?: string; url: string }>,
}));

vi.mock('../../src/stores/media/media.ts', () => ({
  useMediaStore: () => ({ dispatchMediaInfoFetch, addUrlBatchAndDownload }),
}));
vi.mock('../../src/stores/media/group.ts', () => ({
  useMediaGroupStore: () => ({ groups }),
}));

const payload: BridgeMediaAddPayload = {
  url: 'https://example.com/master.m3u8',
  cookieFile: '/tmp/ovd-bridge/cookies.txt',
  headers: ['Referer: https://example.com/watch'],
  download: false,
  title: 'Episode 1',
};

const overrides = {
  auth: {
    cookieFile: '/tmp/ovd-bridge/cookies.txt',
    cookieBrowser: 'none',
    extraHeaders: ['Referer: https://example.com/watch'],
  },
  title: 'Episode 1',
};

describe('bridge listener', () => {
  beforeEach(() => {
    dispatchMediaInfoFetch.mockReset();
    addUrlBatchAndDownload.mockReset();
    for (const id of Object.keys(groups)) delete groups[id];
    installTauriMock({});
    registerBridgeListeners();
  });

  it('queues a link sent by the browser extension with its cookies, headers and title', async () => {
    await emit('bridge_media_add', payload);

    await vi.waitFor(() => expect(dispatchMediaInfoFetch).toHaveBeenCalledTimes(1));
    expect(dispatchMediaInfoFetch).toHaveBeenCalledWith(payload.url, false, false, overrides);
    expect(addUrlBatchAndDownload).not.toHaveBeenCalled();
  });

  it('starts the download right away when asked to, always notifies, and still asks about playlists', async () => {
    await emit('bridge_media_add', { ...payload, download: true });

    await vi.waitFor(() => expect(addUrlBatchAndDownload).toHaveBeenCalledTimes(1));
    // fromShortcut = true forces the notification; skipPlaylistSelection = false keeps the question.
    expect(addUrlBatchAndDownload).toHaveBeenCalledWith([payload.url], true, false, overrides);
    expect(dispatchMediaInfoFetch).not.toHaveBeenCalled();
  });

  it('numbers the title when another item in the queue already has it', async () => {
    groups.first = { title: 'Episode 1', url: 'https://example.com/other/master.m3u8' };

    await emit('bridge_media_add', payload);
    await vi.waitFor(() => expect(dispatchMediaInfoFetch).toHaveBeenCalledTimes(1));
    expect(dispatchMediaInfoFetch).toHaveBeenLastCalledWith(payload.url, false, false, { ...overrides, title: 'Episode 1 (2)' });

    // The same address sent again keeps its name.
    groups.second = { title: 'Episode 1 (2)', url: payload.url };
    await emit('bridge_media_add', payload);
    await vi.waitFor(() => expect(dispatchMediaInfoFetch).toHaveBeenCalledTimes(2));
    expect(dispatchMediaInfoFetch).toHaveBeenLastCalledWith(payload.url, false, false, { ...overrides, title: 'Episode 1 (2)' });
  });

  it('leaves out what the extension did not send', async () => {
    await emit('bridge_media_add', { ...payload, cookieFile: null, headers: [], title: null });

    await vi.waitFor(() => expect(dispatchMediaInfoFetch).toHaveBeenCalledTimes(1));
    // Still no cookies from the browser set in the app: the extension is the one that knows
    // which session, regular or private, this link belongs to.
    expect(dispatchMediaInfoFetch).toHaveBeenCalledWith(payload.url, false, false, {
      auth: { cookieFile: undefined, cookieBrowser: 'none', extraHeaders: undefined },
      title: undefined,
    });
  });

  it('does not leave a rejected promise behind, or log the reason, when adding fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    addUrlBatchAndDownload.mockRejectedValueOnce(new Error('ERROR: Unsupported URL: https://example.com/?token=secret'));

    await emit('bridge_media_add', { ...payload, download: true });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    // yt-dlp's message can quote the address, token included; it must not reach the console (and error reports).
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret');
    consoleError.mockRestore();
  });
});
