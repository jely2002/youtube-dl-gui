import { listen } from '@tauri-apps/api/event';
import { UpdaterDownloadProgressPayload } from '../types/updater';
import { useUpdaterStore } from '../../stores/updater';

export function registerUpdaterListeners() {
  const updaterStore = useUpdaterStore();

  void listen<UpdaterDownloadProgressPayload>('updater_download_progress', (event) => {
    updaterStore.processUpdaterDownloadProgress(event.payload);
  });

  void listen<void>(
    'updater_finished',
    () => {
      updaterStore.processUpdaterFinished();
    },
  );

  void listen<string>(
    'updater_error',
    (event) => {
      updaterStore.processUpdaterError(event.payload);
    },
  );
}
