import * as Sentry from '@sentry/vue';
import router from './router.ts';
import { App } from 'vue';
import type { DownloadOverrides } from './tauri/types/media';

const withoutQuery = (url: unknown) => (typeof url === 'string' ? url.split(/[?#]/)[0] : url);

function scrub(states: Record<string, unknown>): Record<string, unknown> {
  const options = states['media-options'] as { groupOverrides?: Record<string, DownloadOverrides> } | undefined;
  const signedIn = Object.entries(options?.groupOverrides ?? {}).filter(([, overrides]) => overrides?.auth);
  if (!options?.groupOverrides || signedIn.length === 0) return states;

  const groupOverrides = { ...options.groupOverrides };
  for (const [groupId, overrides] of signedIn) {
    groupOverrides[groupId] = { ...overrides, auth: '[redacted]' as unknown as DownloadOverrides['auth'] };
  }
  const scrubbed: Record<string, unknown> = { ...states, 'media-options': { ...options, groupOverrides } };

  const media = states['media-group'] as { groups?: Record<string, Record<string, unknown>> } | undefined;
  if (media?.groups) {
    const groups: Record<string, unknown> = { ...media.groups };
    for (const [groupId] of signedIn) {
      const group = media.groups[groupId];
      // A summary rather than a cleaned copy: addresses sit in many places inside a group
      // (items, formats, entries, thumbnails), and this runs after every store action.
      if (group) {
        groups[groupId] = {
          url: withoutQuery(group.url),
          title: group.title,
          total: group.total,
          processed: group.processed,
          errored: group.errored,
          details: '[left out: this item carries sign-in details]',
        };
      }
    }
    scrubbed['media-group'] = { ...media, groups };
  }
  return scrubbed;
}

/**
 * Store state is attached to error reports. Sign-in details set for a download
 * (cookie files, headers such as Authorization, tokens, passwords) must not be.
 * An item that carries its own sign-in often has an access token in its addresses
 * too, so such an item is reduced to a summary without them.
 */
export function withoutCredentials(states: Record<string, unknown>): Record<string, unknown> {
  try {
    return scrub(states);
  } catch {
    // Sentry would attach the state as it is if this threw. Better none than unscrubbed.
    return { omitted: 'The state could not be cleared of sign-in details.' };
  }
}

export function createSentry(app: App<Element>) {
  if (__E2E__ || __DEV__) return;
  Sentry.init({
    app,
    dsn: 'https://e5ff83f3c84f397db516955ec278c4c6@o762792.ingest.us.sentry.io/4510256640884736',
    integrations: integrations => [
      ...integrations,
      Sentry.browserTracingIntegration({
        router,
        enableHTTPTimings: false,
        enableElementTiming: false,
      }),
    ],
    tracesSampleRate: 0.05,
    sampleRate: 0.25,
    environment: __DEV__ ? 'development' : 'production',
    release: __APP_VERSION__,
    beforeSend(event) {
      if (event.request?.url?.startsWith('ipc://')) return null;
      return event;
    },
    beforeSendTransaction(event) {
      event.spans = event.spans?.filter((span) => {
        if (span.op === 'measure') return false;
        if (span.op?.startsWith('browser')) return false;
        if (span.op?.startsWith('resource')) return false;
        return !span.description?.includes('ipc://');
      });
      if (event.request?.url?.startsWith('ipc://')) return null;
      if (event.spans?.length === 0) return null;
      return event;
    },
  });
}
