import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { clearMocks } from '@tauri-apps/api/mocks';
import { installTauriMock } from '../utils/tauriMock.ts';
import { useMediaStore } from '../../src/stores/media/media';
import { useMediaGroupStore } from '../../src/stores/media/group';
import { useMediaOptionsStore } from '../../src/stores/media/options';
import { useMediaStateStore, MediaState } from '../../src/stores/media/state';
import { useSettingsStore } from '../../src/stores/settings';
import { defaultSettings } from '../../src/tauri/types/config';
import { TrackType, type EntryItem, type MediaAddPayload } from '../../src/tauri/types/media';
import type { Group } from '../../src/tauri/types/group';

const { notify, notifyGroup } = vi.hoisted(() => ({
  notify: vi.fn(),
  notifyGroup: vi.fn(),
}));

vi.mock('../../src/tauri/notifications', () => ({
  notify,
  notifyGroup,
}));

function createEntries(total: number, prefix = 'https://example.com/playlist'): EntryItem[] {
  return Array.from({ length: total }, (_, index) => ({
    index,
    videoUrl: `${prefix}?v=${index + 1}`,
  }));
}

function createPlaylistGroup(groupId: string, total: number): Group {
  const entries = createEntries(total);
  return {
    id: groupId,
    url: 'https://example.com/playlist',
    title: 'Playlist',
    total,
    processed: 0,
    errored: 0,
    isCombined: false,
    audioCodecs: [],
    videoCodecs: [],
    audioTracks: [],
    videoTracks: [],
    formats: [],
    filesize: 0,
    entries,
    items: {
      leader: {
        id: 'leader',
        isLeader: true,
        url: 'https://example.com/playlist',
        title: 'Playlist',
        audioCodecs: [],
        videoCodecs: [],
        audioTracks: [],
        videoTracks: [],
        formats: [],
        filesize: 0,
        entries: [...entries],
        playlistCount: total,
      },
    },
  };
}

function flushAsync() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('media store', () => {
  beforeEach(() => {
    notify.mockReset();
    notifyGroup.mockReset();
    clearMocks();
  });

  afterEach(() => {
    clearMocks();
  });

  it('applies input filter overrides when dispatching media info fetches', async () => {
    const settingsStore = useSettingsStore();
    Object.assign(settingsStore.settings, structuredClone(defaultSettings));
    settingsStore.settings.inputFilters = {
      ...settingsStore.settings.inputFilters,
      minSize: { value: 50, unit: 'MB' },
      dateFilter: { mode: 'after', value: '2026-06-01' },
    };

    const calls: Array<Record<string, unknown>> = [];
    installTauriMock({
      media_info: (_cmd, args) => {
        const payload = args as Record<string, unknown>;
        calls.push(payload);
        return payload.groupId as string;
      },
    });

    const mediaStore = useMediaStore();
    const groupId = await mediaStore.dispatchMediaInfoFetch('https://example.com/video');

    expect(groupId).toBeTypeOf('string');
    expect(calls).toHaveLength(1);
    expect(calls[0].overrides).toEqual({
      inputFilters: {
        minFilesize: '50M',
        dateafter: '20260601',
      },
    });
  });

  it('expands playlists with the selected subset and updates overrides', async () => {
    let expandArgs: Record<string, unknown> | undefined;
    installTauriMock({
      media_playlist_expand: (_cmd, args) => {
        expandArgs = args as Record<string, unknown>;
        return 'group-1';
      },
    });

    const groupStore = useMediaGroupStore();
    const optionsStore = useMediaOptionsStore();
    const stateStore = useMediaStateStore();
    const mediaStore = useMediaStore();

    const group = createPlaylistGroup('group-1', 3);
    groupStore.createGroup(group);
    optionsStore.setOverrides('group-1', {
      inputFilters: {
        matchFilters: '!is_live',
      },
    });

    await mediaStore.expandPlaylistGroup('group-1', {
      rows: [{ id: 'row-1', type: 'range', start: 1, end: 2 }],
    });

    expect(group.entries?.map(entry => entry.videoUrl)).toEqual([
      'https://example.com/playlist?v=1',
      'https://example.com/playlist?v=2',
    ]);
    expect(stateStore.getGroupState('group-1')).toBe(MediaState.fetchingList);
    expect(optionsStore.getOverrides('group-1')).toEqual({
      inputFilters: {
        matchFilters: '!is_live',
        playlistItems: '1:2',
      },
    });
    expect(expandArgs).toMatchObject({
      groupId: 'group-1',
      entries: group.entries,
      overrides: {
        inputFilters: {
          matchFilters: '!is_live',
          playlistItems: '1:2',
        },
      },
    });
  });

  it('removes playlist item overrides when selecting the full playlist', async () => {
    installTauriMock({
      media_playlist_expand: () => 'group-1',
    });

    const groupStore = useMediaGroupStore();
    const optionsStore = useMediaOptionsStore();
    const mediaStore = useMediaStore();

    const group = createPlaylistGroup('group-1', 2);
    groupStore.createGroup(group);
    optionsStore.setOverrides('group-1', {
      inputFilters: {
        playlistItems: '1',
      },
    });

    await mediaStore.expandPlaylistGroup('group-1', { rows: [] });

    expect(optionsStore.getOverrides('group-1')).toBeUndefined();
    expect(group.entries).toHaveLength(2);
  });

  it('keeps overrides given with a link alongside input filter overrides', async () => {
    const settingsStore = useSettingsStore();
    settingsStore.settings.inputFilters = {
      ...settingsStore.settings.inputFilters,
      minSize: { value: 50, unit: 'MB' },
      dateFilter: { mode: 'after', value: '2026-06-01' },
    };

    const calls: Array<Record<string, unknown>> = [];
    installTauriMock({
      media_info: (_cmd, args) => {
        calls.push(args as Record<string, unknown>);
        return null;
      },
    });

    const auth = { cookieFile: '/tmp/cookies.txt', extraHeaders: ['Referer: https://example.com/'] };
    const mediaStore = useMediaStore();
    await mediaStore.dispatchMediaInfoFetch('https://example.com/master.m3u8', false, false, { auth });

    expect(calls[0].overrides).toEqual({
      auth,
      inputFilters: { minFilesize: '50M', dateafter: '20260601' },
    });
  });

  it('shows a title override while fetching and hands it to yt-dlp for the lookup and the download', async () => {
    const infoCalls: Array<Record<string, unknown>> = [];
    const downloads: Array<Record<string, unknown>> = [];
    installTauriMock({
      media_info: (_cmd, args) => {
        infoCalls.push(args as Record<string, unknown>);
        return null;
      },
      media_download: (_cmd, args) => {
        downloads.push(args as Record<string, unknown>);
        return null;
      },
    });

    const groupStore = useMediaGroupStore();
    const mediaStore = useMediaStore();
    const groupId = await mediaStore.dispatchMediaInfoFetch('https://example.com/master.m3u8', false, false, {
      title: 'Episode 1',
    });

    // The card has a name before yt-dlp has answered.
    expect(groupStore.findGroupById(groupId)?.title).toBe('Episode 1');
    expect(infoCalls[0].overrides).toMatchObject({ title: 'Episode 1' });

    mediaStore.processMediaAddPayload({
      groupId,
      total: 1,
      item: {
        id: 'item-1',
        url: 'https://example.com/master.m3u8',
        title: 'Episode 1',
        audioCodecs: [],
        formats: [],
        filesize: 0,
      },
    });
    await mediaStore.downloadGroup(groupId, { trackType: TrackType.both });

    const items = downloads[0].items as Array<{ overrides: Record<string, unknown>; templateContext: { values: Record<string, string> } }>;
    expect(items[0].overrides).toMatchObject({ title: 'Episode 1' });
    // yt-dlp sets the title itself; the app does not write it into the file name template.
    expect(items[0].templateContext.values.title).toBeUndefined();
  });

  it('drops a title override when the link turns out to be a playlist', async () => {
    installTauriMock({});

    const groupStore = useMediaGroupStore();
    const optionsStore = useMediaOptionsStore();
    const stateStore = useMediaStateStore();
    const mediaStore = useMediaStore();
    const auth = { cookieFile: '/tmp/cookies.txt' };
    const groupId = await mediaStore.dispatchMediaInfoFetch('https://example.com/list', false, false, {
      auth,
      title: 'Page title',
    });

    mediaStore.processMediaAddPayload({
      groupId,
      total: 2,
      item: {
        id: 'leader-2',
        url: 'https://example.com/list',
        title: 'Real playlist',
        audioCodecs: [],
        formats: [],
        filesize: 0,
        entries: createEntries(2),
      },
    });

    // Otherwise every entry would be given the same name. The sign-in stays.
    const overrides = optionsStore.getOverrides(groupId);
    expect(overrides).not.toHaveProperty('title');
    expect(overrides?.auth).toEqual(auth);
    expect(groupStore.findGroupById(groupId)?.title).toBe('Real playlist');
    expect(stateStore.getState('leader-2')).toBe(MediaState.playlistSelection);
  });

  it('adds and downloads with the overrides given with a link', async () => {
    const infoCalls: Array<Record<string, unknown>> = [];
    const downloads: Array<Record<string, unknown>> = [];
    installTauriMock({
      media_info: (_cmd, args) => {
        infoCalls.push(args as Record<string, unknown>);
        return null;
      },
      media_download: (_cmd, args) => {
        downloads.push(args as Record<string, unknown>);
        return null;
      },
    });

    const auth = { cookieFile: '/tmp/cookies.txt', extraHeaders: ['Referer: https://example.com/'] };
    const mediaStore = useMediaStore();
    const pending = mediaStore.addAndDownload('https://example.com/clip.m3u8', true, { auth });
    await vi.waitFor(() => expect(infoCalls).toHaveLength(1));
    expect(infoCalls[0].overrides).toMatchObject({ auth });

    // yt-dlp answers; the download then starts with the same sign-in.
    mediaStore.processMediaAddPayload({
      groupId: infoCalls[0].groupId as string,
      total: 1,
      item: {
        id: 'item-3',
        url: 'https://example.com/clip.m3u8',
        title: 'clip',
        audioCodecs: [],
        formats: [],
        filesize: 0,
      },
    });
    await pending;

    const items = downloads[0].items as Array<{ overrides: Record<string, unknown> }>;
    expect(items[0].overrides).toMatchObject({ auth });
  });

  it('uses the title yt-dlp reports when there is no override', async () => {
    installTauriMock({});

    const groupStore = useMediaGroupStore();
    const mediaStore = useMediaStore();
    const groupId = await mediaStore.dispatchMediaInfoFetch('https://example.com/video');
    expect(groupStore.findGroupById(groupId)?.title).toBeUndefined();

    mediaStore.processMediaAddPayload({
      groupId,
      total: 1,
      item: {
        id: 'item-2',
        url: 'https://example.com/video',
        title: 'Real title',
        audioCodecs: [],
        formats: [],
        filesize: 0,
      },
    });

    expect(groupStore.findGroupById(groupId)?.title).toBe('Real title');
  });

  it('falls back to playlist selection when auto-expanding a skipped playlist fails', async () => {
    installTauriMock({
      media_playlist_expand: () => {
        throw new Error('expand failed');
      },
    });

    const groupStore = useMediaGroupStore();
    const stateStore = useMediaStateStore();
    const mediaStore = useMediaStore();

    groupStore.createGroup({
      id: 'group-1',
      url: 'https://example.com/playlist',
      total: 1,
      processed: 0,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      videoCodecs: [],
      audioTracks: [],
      videoTracks: [],
      formats: [],
      filesize: 0,
      skipPlaylistSelection: true,
      items: {
        placeholder: {
          id: 'placeholder',
          isLeader: true,
          url: 'https://example.com/playlist',
          audioCodecs: [],
          formats: [],
          filesize: 0,
        },
      },
    });

    const payload: MediaAddPayload = {
      groupId: 'group-1',
      total: 2,
      item: {
        id: 'leader',
        url: 'https://example.com/playlist',
        title: 'Playlist',
        audioCodecs: [],
        formats: [],
        filesize: 0,
        entries: createEntries(2),
      },
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    mediaStore.processMediaAddPayload(payload);
    await flushAsync();

    expect(stateStore.getState('leader')).toBe(MediaState.playlistSelection);

    consoleError.mockRestore();
  });
});
