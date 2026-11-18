import { addSource, applyInspection, bestStream, classify, cookieNames, inspectManifest, menuSource, pageSource, pickHeaders } from './detect.js';
import { isWeb, sendToApp } from './send.js';

const ALL = { urls: ['<all_urls>'] };
const WATCHED = { ...ALL, types: ['xmlhttprequest', 'media', 'main_frame', 'sub_frame', 'other'] };
const MAX_SOURCES_PER_TAB = 50;
const MAX_MANIFEST_BYTES = 1 << 20;
// Longer than any real address. A page could otherwise fill the extension's storage.
const MAX_URL_CHARS = 4096;
const APP_NAME = 'Open Video Downloader';

// The app's primary green (src/app.css --color-primary).
chrome.action.setBadgeBackgroundColor({ color: '#4cb96b' });

// --- Detection -------------------------------------------------------------

// requestId -> request headers, held only until the response starts.
const sent = new Map();

chrome.webRequest.onSendHeaders.addListener(
  (d) => {
    sent.set(d.requestId, d.requestHeaders);
  },
  WATCHED,
  ['requestHeaders', 'extraHeaders'],
);

chrome.webRequest.onResponseStarted.addListener(
  (d) => {
    const requestHeaders = sent.get(d.requestId);
    sent.delete(d.requestId);
    // Only a GET can be fetched again later. This also skips the permission check
    // (CORS preflight) a browser sends ahead of some requests to the same address.
    if (d.method !== 'GET' || d.tabId < 0 || d.statusCode >= 400 || d.url.length > MAX_URL_CHARS) return;
    // A page Chrome is preloading in the background is not the one the user is looking at.
    if (d.documentLifecycle === 'prerender') return;

    const header = name => d.responseHeaders?.find(h => h.name.toLowerCase() === name)?.value;
    const length = header('content-range')?.split('/')[1] ?? header('content-length');
    const size = length === undefined || Number.isNaN(Number(length)) ? undefined : Number(length);
    const kind = classify({ url: d.url, type: d.type, contentType: header('content-type'), size });
    if (!kind) return;

    const source = {
      url: d.url,
      kind,
      headers: pickHeaders(requestHeaders),
      cookieNames: cookieNames(requestHeaders),
      // Who asked: the page itself, or a frame from another site embedded in it.
      initiator: d.initiator ?? '',
      // The page asking its own site from its own frame. Only then did the browser send
      // that site's cookies in full, so only then may they be sent when reading it again.
      firstParty: d.frameId === 0 && d.initiator === new URL(d.url).origin,
    };
    // A manifest's own size says nothing about the stream it describes.
    remember(d.tabId, kind === 'file' ? { ...source, size } : source);
  },
  WATCHED,
  ['responseHeaders'],
);

chrome.webRequest.onErrorOccurred.addListener(d => sent.delete(d.requestId), ALL);

// --- A tab's state ----------------------------------------------------------------
// Kept in session storage: the worker is stopped when idle and loses its memory.
//   "<tabId>"       the sources detected on the page in that tab
//   "page:<tabId>"  { path, url, gen } of that page; see `moved`

// Storage updates are read-modify-write, so run them one at a time.
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch(console.error);
}

async function read(key) {
  return (await chrome.storage.session.get(key))[key];
}

async function getList(tabId) {
  return await read(String(tabId)) ?? [];
}

async function setList(tabId, list) {
  await chrome.storage.session.set({ [String(tabId)]: list });
  // The tab may have closed meanwhile.
  await chrome.action.setBadgeText({ tabId, text: String(list.length || '') }).catch(() => {});
}

function pathOf(url) {
  const { origin, pathname } = new URL(url);
  return origin + pathname;
}

function setPage(tabId, url, gen) {
  return chrome.storage.session.set({ [`page:${tabId}`]: { path: pathOf(url), url, gen } });
}

async function startPage(tabId, url) {
  // The list first: emptying it also frees room if storage had filled up.
  await setList(tabId, []);
  await setPage(tabId, url, 0);
}

// A new page starts a new list. Frame 0 is the visible page's own frame; this also fires
// when a page comes back from the back/forward cache or a preloaded page takes over.
chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId === 0) enqueue(() => startPage(d.tabId, d.url));
});

// Single-page sites change address without loading a page.
function moved(d) {
  if (d.frameId !== 0) return;
  enqueue(async () => {
    const page = await read(`page:${d.tabId}`);
    // The extension started after this page loaded: note where it is, keep what was found.
    if (!page) return setPage(d.tabId, d.url, 0);
    // A new path is a new page.
    if (page.path !== pathOf(d.url)) return startPage(d.tabId, d.url);
    // A new query or fragment may be the next video or only a playback position. Keep
    // the list, and count a new generation so that what loads from now on ranks first.
    if (page.url !== d.url) return setPage(d.tabId, d.url, page.gen + 1);
  });
}
chrome.webNavigation.onHistoryStateUpdated.addListener(moved);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(moved);

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => chrome.storage.session.remove([String(tabId), `page:${tabId}`]));
});

function remember(tabId, detected) {
  enqueue(async () => {
    const page = await read(`page:${tabId}`);
    const source = { ...detected, gen: page?.gen ?? 0 };
    const pageOrigin = page ? new URL(page.url).origin : undefined;
    const result = addSource(await getList(tabId), source, MAX_SOURCES_PER_TAB, pageOrigin);
    if (!result) return;
    await setList(tabId, result.list);
    if ((result.added || result.moved) && source.kind !== 'file') void inspect(tabId, source);
  });
}

// --- Reading manifests -----------------------------------------------------------------
// A web page decides which addresses end up here, so these requests must not be able to
// do anything the page could not already do itself.

async function fetchText(url, credentials) {
  // No redirects: the address was already the final one when the page fetched it, so a
  // redirect now would be the server steering this request somewhere else.
  const response = await fetch(url, { credentials, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_MANIFEST_BYTES) {
      await reader.cancel();
      throw new Error('Too large to be a manifest');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
}

/** Reads a detected manifest to label DRM and quality, and to fold its variants into it. */
async function inspect(tabId, source) {
  // The worker's requests go out from the regular profile. A private tab's addresses
  // must not leak into it.
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.incognito) return;

  const credentials = source.firstParty ? 'include' : 'omit';
  let info;
  try {
    info = inspectManifest(source.kind, await fetchText(source.url, credentials), source.url);
  } catch {
    return; // Not readable from here (it may need the page's Referer): leave it unlabelled.
  }

  // HLS keys usually sit in the variant playlists, not the master. A manifest can name
  // any address as a variant, so only follow one on the master's own site, and without
  // cookies: unlike the master, the page may never have asked for it.
  const first = info.variants.find(url => new URL(url).origin === new URL(source.url).origin);
  if (!info.drm && first) {
    try {
      info.drm = inspectManifest('hls', await fetchText(first, 'omit'), first).drm;
    } catch {
      // Keep what the master told us.
    }
  }

  enqueue(async () => {
    const list = applyInspection(await getList(tabId), source, info);
    if (list) await setList(tabId, list);
  });
}

// --- Right-click menu and keyboard shortcut ----------------------------------

chrome.runtime.onInstalled.addListener(() => {
  // Menus survive updates; start clean so creating them again cannot fail.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'page', title: `Send this page to ${APP_NAME}`, contexts: ['page'] });
    chrome.contextMenus.create({ id: 'link', title: `Send link to ${APP_NAME}`, contexts: ['link'] });
    chrome.contextMenus.create({ id: 'media', title: `Send this video or audio to ${APP_NAME}`, contexts: ['video', 'audio'] });
  });
});

async function sendAndNotify(source, tab) {
  const message = isWeb(source.url) ? await sendToApp(source, tab) : 'Open a web page to find videos.';
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/128.png', title: APP_NAME, message });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  await sendAndNotify(menuSource(info, tab.url, await getList(tab.id), navigator.userAgent), tab);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'send-best') return;
  tab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab) return;
  // A stream the page loaded if there is one, otherwise the page for the app to work out.
  const source = bestStream(await getList(tab.id), tab.url) ?? pageSource(tab.url, navigator.userAgent);
  await sendAndNotify(source, tab);
});
