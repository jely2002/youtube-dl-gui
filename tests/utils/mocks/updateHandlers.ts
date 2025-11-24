import { IPCHandler } from '../tauriMock';
import { emit } from '@tauri-apps/api/event';
import { UpdaterCheckPayload, UpdaterDownloadProgressPayload } from '../../../src/tauri/types/updater';

export type UpdaterMockData = {
  available?: boolean;
  currentVersion?: string;
  availableVersion?: string;
};

export const updateHandlers: Record<string, IPCHandler> = {
  updater_check: (): UpdaterCheckPayload => {
    return {
      available: window.E2E.updater?.available ?? false,
      currentVersion: window.E2E.updater?.currentVersion ?? '1.0.0',
      availableVersion: window.E2E.updater?.availableVersion,
    };
  },
  updater_download: async (): Promise<void> => {
    if (window.E2E.updater?.available) {
      return new Promise((resolve): void => {
        setTimeout((): void => {
          void emit<UpdaterDownloadProgressPayload>('updater_download_progress', {
            received: 1024 * 1024 * 5,
            total: 1024 * 1024 * 10,
          });
        }, 1000);
        setTimeout((): void => {
          void emit<UpdaterDownloadProgressPayload>('updater_download_progress', {
            received: 1024 * 1024 * 10,
            total: 1024 * 1024 * 10,
          });
        }, 2000);
        setTimeout(resolve, 3000);
      });
    } else {
      return Promise.resolve();
    }
  },
  updater_install: (): void => {
    void emit<void>('updater_finished');
  },
};
