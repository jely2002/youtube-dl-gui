// Runs as both the toolbar popup and the side panel (popup.html?panel).
import { isOwn, pageSource, rank, sourceKey } from './detect.js';
import { forgetKey, getKey, isPairing, isWeb, requestKey, sendToApp, useKey } from './send.js';

const KIND_LABEL = { hls: 'HLS stream', dash: 'DASH stream', file: 'Media file' };

const $ = id => document.getElementById(id);
const list = $('sources');
const hint = $('hint');
const status = $('status');
const connect = $('connect');
const disconnect = $('disconnect');

document.documentElement.classList.toggle('panel', location.search === '?panel');

let tab;
let renders = 0;
let busy = false;
// What each row's buttons act on. Kept apart from the rows, so that a source can change
// (a refreshed address, say) without the row being rebuilt under the pointer.
const sources = new Map();
// Row ids in the order shown. New rows go to the end rather than re-sorting the list
// while the user is aiming at one.
let order = [];
// What is on screen, to skip rebuilding it when nothing visible changed.
let shown = '';

function el(tag, props, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function pageOf(url) {
  try {
    const { origin, pathname } = new URL(url);
    return origin + pathname;
  } catch {
    return '';
  }
}

function describe(source) {
  const { hostname, pathname } = new URL(source.url);
  const facts = [
    KIND_LABEL[source.kind],
    source.height && `up to ${source.height}p`,
    source.size && `${(source.size / 1048576).toFixed(1)} MB`,
  ].filter(Boolean).join(' · ');
  let detail = hostname + pathname;
  if (!isOwn(source, tab.url)) {
    // Loaded by a frame from another site: a player the page embeds, or an advert.
    const frame = URL.canParse(source.initiator) ? new URL(source.initiator).hostname : 'another site';
    detail += ` · embedded from ${frame}`;
  }
  return { id: sourceKey(source), title: facts, name: `${facts}, ${detail}`, detail, drm: Boolean(source.drm), source };
}

async function render() {
  const run = ++renders;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const connected = Boolean(await getKey());
  const isWebPage = isWeb(active?.url);
  const key = String(active?.id);
  const detected = isWebPage ? (await chrome.storage.session.get(key))[key] ?? [] : [];
  if (run !== renders) return; // A newer render started while this one waited.

  // A message, and an order, about one page say nothing about the next.
  if (active?.id !== tab?.id || pageOf(active?.url) !== pageOf(tab?.url)) {
    status.textContent = '';
    order = [];
  }
  tab = active;

  connect.hidden = connected;
  disconnect.hidden = !connected;
  // The popup closed when the app came forward to ask; pick up where the user left off.
  if (!connected && !status.textContent && await isPairing()) {
    status.textContent = 'Allowed the connection in the app? Paste the key above and choose Finish.';
    $('key').focus();
  }

  const rows = [];
  if (connected && isWebPage) {
    const title = tab.title || 'This page';
    const page = pageSource(tab.url, navigator.userAgent);
    rows.push({ id: 'page', title, name: title, detail: 'Let the app work out the video from the page address', drm: false, source: page });

    const found = new Map(rank(detected, tab.url).map(source => [sourceKey(source), source]));
    order = [...order.filter(id => found.has(id)), ...[...found.keys()].filter(id => !order.includes(id))];
    rows.push(...order.map(id => describe(found.get(id))));
  }

  sources.clear();
  for (const { id, source } of rows) sources.set(id, source);

  const signature = JSON.stringify(rows.map(({ id, title, detail, drm }) => [id, title, detail, drm]));
  if (signature !== shown) {
    shown = signature;
    // Sources arrive while the user is tabbing through the list: keep their place.
    const focused = document.activeElement?.dataset?.focusKey;
    list.replaceChildren(...rows.map(row));
    if (focused) [...list.querySelectorAll('button')].find(button => button.dataset.focusKey === focused)?.focus();
  }

  hint.hidden = !connected || !isWebPage || detected.length > 0;
  if (connected && !isWebPage) status.textContent = 'Open a web page to find videos.';
}

/** @param name what a screen reader calls the row; every row has the same three buttons */
function row({ id, title, name, detail, drm }) {
  const send = download => async () => {
    const source = sources.get(id);
    if (busy || !source) return; // One at a time: a second click would queue it twice.
    busy = true;
    status.textContent = 'Sending…';
    try {
      status.textContent = await sendToApp(source, tab, download);
    } finally {
      busy = false;
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(sources.get(id).url);
    status.textContent = 'Address copied.';
  };
  const button = (text, props) => {
    const node = el('button', { type: 'button', textContent: text, ariaLabel: `${text}: ${name}`, ...props });
    node.dataset.focusKey = `${text} ${id}`;
    return node;
  };
  return el('li', {},
    el('div', { className: 'title' },
      title,
      // A warning, not a block: the check can be wrong, and the app gives the final answer.
      ...(drm ? [el('span', { className: 'badge', textContent: 'DRM protected, download will likely fail' })] : []),
    ),
    el('small', { className: 'detail', textContent: detail, title: sources.get(id).url }),
    el('div', { className: 'actions' },
      button('Download now', { className: 'primary', onclick: send(true) }),
      button('Add to queue', { onclick: send(false) }),
      button('Copy address', { onclick: copy }),
    ),
  );
}

$('reload').addEventListener('click', () => chrome.tabs.reload(tab.id));
$('open-panel').addEventListener('click', async () => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
});

// Connecting: the app hands over its key through the clipboard, which only programs in
// this user's session can read, and the user pastes it here.
$('request-key').addEventListener('click', async () => {
  status.textContent = 'Asking Open Video Downloader…';
  status.textContent = await requestKey();
  $('key').focus();
});
$('use-key').addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = 'Checking the key…';
  const problem = await useKey($('key').value);
  $('key').value = '';
  status.textContent = problem || 'Connected to Open Video Downloader.';
  if (problem) return;
  await render();
  // The form that had the focus is gone; put it on the first thing the user can do next.
  (list.querySelector('button') ?? disconnect).focus();
});
disconnect.addEventListener('click', async () => {
  await forgetKey();
  status.textContent = '';
  await render();
});

// The side panel stays open while sources arrive, tabs change and the key is set elsewhere.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' ? String(tab?.id) in changes : 'key' in changes) void render();
});
chrome.tabs.onActivated.addListener(render);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.status === 'complete' || change.title || change.url) void render();
});

await render();
