import { headersFor, hmacHex, inPartition, isOwn, toNetscape } from './detect.js';

// Keep in sync with src-tauri/src/bridge.rs.
const APP = 'http://127.0.0.1:46123';
const KEY_PATTERN = /^[0-9a-f]{64}$/;

const UNREACHABLE = 'Could not reach Open Video Downloader. Is it running?';
const NOT_CONNECTED = 'Connect the extension to Open Video Downloader first: click its icon in the toolbar.';
const NOT_RECOGNIZED = 'Open Video Downloader does not recognize this browser. Disconnect and connect again from the extension\'s popup.';

export const isWeb = url => /^https?:/.test(url ?? '');

/** The connection key the user pasted from the app, if any. */
export async function getKey() {
  return (await chrome.storage.local.get('key')).key;
}

export function forgetKey() {
  return chrome.storage.local.remove('key');
}

function post(path, body, headers = {}) {
  return fetch(APP + path, {
    method: 'POST',
    // The app only accepts JSON; see `route` in src-tauri/src/bridge.rs.
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
    // Never the browser's own cookies for this address (a local development site's, say),
    // and nowhere but this address.
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Checks that whatever answers on the app's port holds `key`, which only the real app
 * does. Nothing private is sent before this passes.
 * @returns {Promise<string | null>} the challenge to sign the next request with, or null
 */
async function greet(key) {
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const response = await post('/hello', JSON.stringify({ nonce }));
  if (!response.ok) return null;
  const { proof, nonce: challenge } = await response.json();
  return proof === await hmacHex(key, `app:${nonce}`) ? challenge : null;
}

/**
 * Asks the app to offer its connection key. The user approves in the app, which then
 * puts the key on the clipboard.
 * @returns {Promise<string>} a message for the user
 */
export async function requestKey() {
  try {
    const response = await post('/pair', '{}');
    if (response.status === 429) return 'Open Video Downloader was asked a moment ago. Answer it there, or try again in a minute.';
    if (response.status !== 202) return `Open Video Downloader refused the request (${response.status}).`;
    // The toolbar popup closes when the app comes forward; remember to ask for the key next time.
    await chrome.storage.session.set({ pairing: Date.now() });
    return 'Open Video Downloader is asking you to allow the connection. Allow it, then paste the key below.';
  } catch (error) {
    console.error(error);
    return UNREACHABLE;
  }
}

/**
 * Stores the key the user pasted, once the app has proven it is the right one.
 * @returns {Promise<string>} an error message for the user, or '' when connected
 */
export async function useKey(text) {
  const key = text.trim().toLowerCase();
  if (!KEY_PATTERN.test(key)) return 'That is not a connection key. Click Connect, allow it in the app, then paste here.';
  try {
    if (!await greet(key)) return 'That key does not match the app that is running. Click Connect to get a new one.';
  } catch (error) {
    console.error(error);
    return UNREACHABLE;
  }
  await chrome.storage.local.set({ key });
  await chrome.storage.session.remove('pairing');
  return '';
}

/** The cookies the browser holds for `url` in this tab's session. */
async function cookiesFor(url, tab) {
  if (!isWeb(url)) return [];
  // An incognito tab has its own cookie store; the default is the regular one.
  const stores = await chrome.cookies.getAllCookieStores();
  const storeId = stores.find(store => store.tabIds.includes(tab.id))?.id;
  // An empty partition key asks for partitioned cookies as well as ordinary ones.
  const cookies = await chrome.cookies.getAll({ url, storeId, partitionKey: {} });
  return cookies.filter(cookie => inPartition(cookie, tab.url));
}

/** Whether the pairing step is waiting for the user to paste a key (asked in the last ten minutes). */
export async function isPairing() {
  const { pairing } = await chrome.storage.session.get('pairing');
  return Boolean(pairing) && Date.now() - pairing < 600_000;
}

/**
 * Sends a source with its headers and cookies to the app.
 * @param {{ url: string, kind?: string, initiator?: string, headers?: string[] }} source
 *   a detected source (it has a `kind`), or a page or link for the app to work out itself
 * @param {chrome.tabs.Tab} tab the tab the source was found in
 * @param {boolean} download start downloading instead of only queueing
 * @returns {Promise<string>} a message for the user
 */
export async function sendToApp(source, tab, download = false) {
  const key = await getKey();
  if (!key) return NOT_CONNECTED;
  let challenge;
  try {
    challenge = await greet(key);
  } catch (error) {
    console.error(error);
    return UNREACHABLE;
  }
  if (!challenge) return NOT_RECOGNIZED;

  const { url } = source;
  let cookies;
  try {
    cookies = await cookiesFor(url, tab);
    // Only the cookies the browser sent with the request when it loaded the source. It may
    // hold others for that address that it would not send from this page.
    if (source.cookieNames) cookies = cookies.filter(cookie => source.cookieNames.includes(cookie.name));
    // The page's own cookies go along only with what the page itself loaded (a stream on
    // another host may fetch its key from the page's site), not with what a frame from
    // another site loaded or a link elsewhere.
    const fromPage = source.kind ? isOwn(source, tab.url) : url === tab.url;
    if (fromPage) cookies.push(...await cookiesFor(tab.url, tab));
  } catch (error) {
    console.error(error);
    return 'Could not read this site\'s cookies. Check the extension\'s site access in chrome://extensions.';
  }

  const body = JSON.stringify({
    url,
    headers: headersFor(source, tab.url, navigator.userAgent),
    cookies: toNetscape(cookies),
    download,
    // The app reads a page's title itself; a raw stream is named after the page it came from.
    // The app adds a number when it already has an item of that name.
    title: source.kind ? tab.title : undefined,
  });
  try {
    const proof = await hmacHex(key, `ext:${challenge}:${body}`);
    const response = await post('/add', body, { 'X-OVD-Nonce': challenge, 'X-OVD-Proof': proof });
    return response.ok
      ? 'Sent to Open Video Downloader.'
      : `Open Video Downloader refused the request (${response.status}).`;
  } catch (error) {
    console.error(error);
    return UNREACHABLE;
  }
}
