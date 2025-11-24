import { listen } from '@tauri-apps/api/event';
import { useMediaDestinationStore } from '../../stores/media/destination';
import { MediaDestinationPayload } from '../types/destination';

export function registerDestinationListeners() {
  const destinationStore = useMediaDestinationStore();

  void listen<MediaDestinationPayload>('media_destination', (event) => {
    destinationStore.processMediaDestinationPayload(event.payload);
  });
}
