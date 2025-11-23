import { listen } from '@tauri-apps/api/event';
import { NavigatePayload } from '../types/app.ts';
import router from '../../router.ts';

export function registerAppListeners() {
  void listen<NavigatePayload>('navigate', (event) => {
    void router.push({ name: event.payload.route });
  });
}
