import { listen } from '@tauri-apps/api/event';
import { useMediaProgressStore } from '../../stores/media/progress';
import { MediaProgressCompletePayload, MediaProgressPayload, MediaProgressStagePayload } from '../types/progress';

export function registerProgressListeners() {
  const progressStore = useMediaProgressStore();

  void listen<MediaProgressPayload>('media_progress', (event) => {
    progressStore.processMediaProgressPayload(event.payload);
  });

  void listen<MediaProgressStagePayload>('media_progress_stage', (event) => {
    progressStore.processMediaProgressStagePayload(event.payload);
  });

  void listen<MediaProgressCompletePayload>('media_complete', (event) => {
    progressStore.processMediaCompletePayload(event.payload);
  });
}
