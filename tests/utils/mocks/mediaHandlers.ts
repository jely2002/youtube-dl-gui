import { ensureInvokeArgsObject, IPCHandler } from '../tauriMock';
import { InvokeArgs } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { MediaAddPayload, MediaFormat } from '../../../src/tauri/types/media';

const sampleFormats: MediaFormat[] = [
  { id: 'f1080', height: 1080, fps: 60, videoCodecs: [] },
  { id: 'f720', height: 720, fps: 30, videoCodecs: [] },
  { id: 'audio', asr: 120, videoCodecs: [] },
];

export const mediaHandlers: Record<string, IPCHandler> = {
  media_info: (_cmd: string, args: InvokeArgs | undefined): string => {
    const { groupId, id, url } = ensureInvokeArgsObject<{ groupId: string; id: string; url: string }>(args, 'media_info');

    if (url.includes('playlist-small')) {
      void emitAddMedia(id, url, groupId, 2);
      return groupId;
    }
    if (url.includes('playlist-large')) {
      void emitAddMedia(id, url, groupId, 50);
      return groupId;
    }
    void emit<MediaAddPayload>('media_add', {
      groupId,
      total: 1,
      item: { id, url, title: 'Test Video', audioCodecs: ['aac'], formats: sampleFormats, filesize: 123, isLeader: true },
    });
    return 'test-group';
  },
};

const emitAddMedia = async (id: string, url: string, groupId: string, total: number): Promise<string> => {
  await emit<MediaAddPayload>('media_add', {
    groupId,
    total,
    item: { id: `${id}-pl`, url, title: 'Playlist', audioCodecs: ['aac'], formats: sampleFormats, filesize: 0, entries: [] },
  });
  for (let i = 0; i < total; i++) {
    void emit<MediaAddPayload>('media_add', {
      groupId,
      total,
      item: {
        id: `${id}-${i}`,
        url: `${url}?v=${i}`,
        title: `Item ${i}`,
        audioCodecs: ['aac'],
        formats: sampleFormats,
        filesize: 0,
      },
    });
  }
  return groupId;
};
