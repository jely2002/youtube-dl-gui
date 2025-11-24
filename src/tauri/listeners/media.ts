import { listen } from '@tauri-apps/api/event';
import { useMediaStore } from '../../stores/media/media';
import { useMediaSizeStore } from '../../stores/media/size';
import { MediaAddPayload, MediaAddWithFormatPayload } from '../types/media';

export function registerMediaListeners() {
  const mediaStore = useMediaStore();
  const sizeStore = useMediaSizeStore();

  void listen<MediaAddPayload>('media_add', (event) => {
    mediaStore.processMediaAddPayload(event.payload);
    sizeStore.processMediaAddPayload(event.payload);
  });

  void listen<MediaAddWithFormatPayload>('media_size', (event) => {
    sizeStore.processMediaSizePayload(event.payload);
  });
}
