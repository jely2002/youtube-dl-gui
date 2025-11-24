import { listen } from '@tauri-apps/api/event';
import {
  BinaryDownloadStartPayload,
  BinaryDownloadProgressPayload,
  BinaryDownloadCompletePayload, BinaryDownloadErrorPayload,
} from '../types/binaries';
import { useBinariesStore } from '../../stores/binaries';

export function registerBinaryListeners() {
  const binariesStore = useBinariesStore();

  void listen<BinaryDownloadStartPayload>('binary_download_start', (event) => {
    binariesStore.processBinaryDownloadStart(event.payload);
  });

  void listen<BinaryDownloadProgressPayload>(
    'binary_download_progress',
    (event) => {
      binariesStore.processBinaryDownloadProgress(event.payload);
    },
  );

  void listen<BinaryDownloadCompletePayload>(
    'binary_download_complete',
    (event) => {
      binariesStore.processBinaryDownloadComplete(event.payload);
    },
  );

  void listen<BinaryDownloadErrorPayload>('binary_download_error', (event) => {
    binariesStore.processBinaryDownloadError(event.payload);
  });
}
