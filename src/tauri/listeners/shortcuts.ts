import { listen } from '@tauri-apps/api/event';
import { ShortcutActionPayload } from '../types/shortcuts.ts';
import { useMediaStore } from '../../stores/media/media.ts';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { isValidUrl } from '../../helpers/url.ts';

export function registerShortcutListeners() {
  const mediaStore = useMediaStore();

  void listen<ShortcutActionPayload>('shortcut_action', async (event) => {
    switch (event.payload.action) {
      case 'media_add': {
        const url = await readText();
        if (!isValidUrl(url)) {
          return;
        }
        await mediaStore.dispatchMediaInfoFetch(url, true);
        break;
      }
      case 'download_all': {
        await mediaStore.downloadAllGroups(true);
        break;
      }
      default: {
        console.warn(`Unknown shortcut action: ${event.payload.action}`);
      }
    }
  });
}
