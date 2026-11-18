import { listen } from '@tauri-apps/api/event';
import { useMediaStore } from '../../stores/media/media.ts';
import { useMediaGroupStore } from '../../stores/media/group.ts';
import { uniqueTitle } from '../../helpers/groups.ts';
import { DownloadOverrides } from '../types/media';

export interface BridgeMediaAddPayload {
  url: string;
  cookieFile: string | null;
  headers: string[];
  download: boolean;
  title: string | null;
}

// Links sent by the browser extension (see src-tauri/src/bridge.rs).
export function registerBridgeListeners() {
  const mediaStore = useMediaStore();
  const groupStore = useMediaGroupStore();

  void listen<BridgeMediaAddPayload>('bridge_media_add', async ({ payload }) => {
    const overrides: DownloadOverrides = {
      auth: {
        cookieFile: payload.cookieFile ?? undefined,
        // Not the cookies of the browser chosen in the settings as well: yt-dlp would read
        // every one of them into the file above, whichever session this link belongs to.
        cookieBrowser: 'none',
        // On top of the headers set in the app, not instead of them.
        extraHeaders: payload.headers.length > 0 ? payload.headers : undefined,
      },
      // A stream is named after the page it came from, and several can come from one page.
      title: payload.title ? uniqueTitle(payload.title, payload.url, Object.values(groupStore.groups)) : undefined,
    };
    try {
      if (payload.download) {
        // Like a global shortcut, this starts while the user is in another app: always notify.
        // Unlike it, a playlist still asks which items to take: one click on a channel page
        // must not download all of it.
        await mediaStore.addUrlBatchAndDownload([payload.url], true, false, overrides);
      } else {
        await mediaStore.dispatchMediaInfoFetch(payload.url, false, false, overrides);
      }
    } catch {
      // The queue shows what went wrong, and nobody is waiting on this promise. The error
      // is not logged: yt-dlp's message can quote the address, access token included.
      console.error('Could not add the link sent by the browser extension.');
    }
  });
}
