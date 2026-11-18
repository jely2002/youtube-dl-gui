// Loads the browser extension (extension/) into Chromium and checks the whole path:
// detection on a page, connecting to the app, the popup, and what the app's bridge receives.
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

const extensionPath = fileURLToPath(new URL('../../extension', import.meta.url));
// The address the extension posts to (extension/send.js).
const BRIDGE_PORT = 46123;
// The only origin the app accepts. The `key` in extension/manifest.json must produce it.
const bridgeSource = readFileSync(new URL('../../src-tauri/src/bridge.rs', import.meta.url), 'utf8');
const EXTENSION_ORIGIN = /EXTENSION_ORIGIN: &str = "([^"]+)"/.exec(bridgeSource)![1];
// What the real app would have generated and handed over on the clipboard.
const APP_KEY = 'ab'.repeat(32);

const MASTER = [
  '#EXTM3U',
  '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720',
  '720.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080',
  '1080.m3u8',
].join('\n');
const LATE_MASTER = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=9000000,RESOLUTION=3840x2160\n2160.m3u8\n';
// Plain AES-128 is ordinary encryption that yt-dlp handles, not DRM.
const VARIANT = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:4,\nsegment1.ts\n#EXT-X-ENDLIST\n';
const mpd = (body: string) => `<?xml version="1.0"?>\n<MPD><Period><AdaptationSet>${body}</AdaptationSet></Period></MPD>`;
const DRM_MPD = mpd('<ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/><Representation id="v" height="2160"/>');
const AD_MPD = mpd('<Representation id="v" height="360"/>');

// The slice of the extension API this test touches; the project has no Chrome type definitions.
type Tab = { id: number; url?: string; title?: string; windowId: number };
declare const chrome: {
  webRequest: Record<'onSendHeaders' | 'onResponseStarted', { hasListeners(): boolean }>;
  tabs: { query(query: object): Promise<Tab[]> };
  storage: { session: { get(key: string): Promise<Record<string, unknown>> } };
  action: { getBadgeText(details: { tabId: number }): Promise<string> };
};

type Received = { path: string; method: string; headers: IncomingMessage['headers']; body: string };
type Source = { url: string; kind: string; headers: string[]; initiator: string; drm?: boolean; height?: number; size?: number };
type AddBody = { url: string; headers: string[]; cookies: string; download: boolean; title?: string };

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

const originOf = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const hmac = (key: string, message: string) => createHmac('sha256', key).update(message).digest('hex');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

/**
 * A site with an HLS stream, a DRM-protected DASH stream, a media file, a stream on another
 * site, and a frame from that other site (as an advert or an embedded player would be).
 */
function createSite(otherSite: () => string): Server {
  return createServer((req, res) => {
    const send = (type: string, body: string | Buffer, headers: Record<string, string> = {}) => {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), ...headers });
      res.end(body);
    };
    const page = `<!doctype html><title>Fixture Show</title><h1>Fixture</h1><iframe src="${otherSite()}/frame"></iframe><script>
      for (const path of ['/hls/master.m3u8', '/hls/720.m3u8', '/drm/manifest.mpd', '/clip.mp4', '/api/data.json']) {
        fetch(path).catch(() => {});
      }
      fetch('${otherSite()}/auth/live.m3u8', { headers: { Authorization: 'Bearer token' } }).catch(() => {});
    </script>`;
    switch (req.url) {
      case '/watch': return send('text/html', page, { 'Set-Cookie': 'session=abc; Path=/; HttpOnly' });
      case '/empty': return send('text/html', '<!doctype html><title>Nothing here</title>');
      case '/hls/master.m3u8': return send('application/vnd.apple.mpegurl', MASTER);
      case '/late/master.m3u8': return send('application/vnd.apple.mpegurl', LATE_MASTER);
      case '/late/2160.m3u8': return send('application/vnd.apple.mpegurl', VARIANT);
      case '/hls/720.m3u8':
      case '/hls/1080.m3u8': return send('application/vnd.apple.mpegurl', VARIANT);
      case '/drm/manifest.mpd': return send('application/dash+xml', DRM_MPD);
      case '/clip.mp4': return send('video/mp4', Buffer.alloc(2 * 1024 * 1024));
      case '/api/data.json': return send('application/json', '{}');
      default: res.writeHead(404).end();
    }
  });
}

/**
 * Another site. Its stream needs an Authorization header: a page on the first site has to
 * ask permission before sending one (a preflight), and the stream cannot be read without it.
 * It also serves the frame the first site embeds, which loads a stream of its own.
 */
function createOtherSite(): Server {
  return createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': req.headers.origin ?? '*', 'Access-Control-Allow-Headers': 'authorization' };
    const send = (type: string, body: string) => {
      res.writeHead(200, { ...cors, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
    };
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    switch (req.url) {
      case '/frame': return send('text/html', '<!doctype html><script>fetch("/frame/ad.mpd").catch(() => {});</script>');
      case '/frame/ad.mpd': return send('application/dash+xml', AD_MPD);
      case '/auth/live.m3u8':
        if (req.headers.authorization !== 'Bearer token') return res.writeHead(401, cors).end();
        return send('application/vnd.apple.mpegurl', VARIANT);
      default: res.writeHead(404, cors).end();
    }
  });
}

/**
 * Stands in for the app (src-tauri/src/bridge.rs): proves it holds the key, and accepts
 * only links signed with it. Records every request.
 */
function createBridge(received: Received[], key: string): Server {
  const challenges = new Set<string>();
  return createServer((req, res) => {
    void readBody(req).then((body) => {
      const path = req.url ?? '';
      received.push({ path, method: req.method ?? '', headers: req.headers, body });
      const reply = (status: number, json?: object) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(json ?? {}));
      if (path === '/pair') return reply(202);
      if (path === '/hello') {
        const challenge = randomUUID().replaceAll('-', '');
        challenges.add(challenge);
        const { nonce } = JSON.parse(body) as { nonce: string };
        return reply(200, { proof: hmac(key, `app:${nonce}`), nonce: challenge });
      }
      const challenge = String(req.headers['x-ovd-nonce']);
      const signed = challenges.delete(challenge) && req.headers['x-ovd-proof'] === hmac(key, `ext:${challenge}:${body}`);
      return reply(path === '/add' && signed ? 200 : 401);
    });
  });
}

test.describe('browser extension', () => {
  const received: Received[] = [];
  const added = () => received.filter(request => request.path === '/add').map(request => JSON.parse(request.body) as AddBody);
  let site: Server;
  let otherSite: Server;
  let bridge: Server;
  let bridgeRunning = false;
  let context: BrowserContext;
  let worker: Worker;
  let origin: string;
  let otherOrigin: string;

  test.beforeAll(async () => {
    bridge = createBridge(received, APP_KEY);
    try {
      await listen(bridge, BRIDGE_PORT);
      bridgeRunning = true;
    } catch (error) {
      // On a developer's machine the real app may be running and own the port; the test
      // would talk to it instead of its stand-in, so it is skipped. In CI nothing should hold it.
      if (process.env.CI) throw error;
      return;
    }
    otherSite = createOtherSite();
    await listen(otherSite, 0);
    otherOrigin = originOf(otherSite);
    site = createSite(() => otherOrigin);
    await listen(site, 0);
    origin = originOf(site);

    context = await chromium.launchPersistentContext('', {
      // The full browser: the default headless shell cannot load extensions.
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    // A request that starts before the extension has is seen without its headers.
    await expect.poll(() => worker.evaluate(() => {
      return chrome.webRequest.onSendHeaders.hasListeners() && chrome.webRequest.onResponseStarted.hasListeners();
    })).toBe(true);
  });

  test.afterAll(async () => {
    await context?.close();
    if (site) await close(site);
    if (otherSite) await close(otherSite);
    if (bridgeRunning) await close(bridge);
  });

  /** `chrome-extension://<id>`. Node gives no origin for addresses of this kind. */
  const extensionOrigin = () => {
    const { protocol, host } = new URL(worker.url());
    return `${protocol}//${host}`;
  };

  /** Opens the popup as a page, pointed at `tab` the way the toolbar popup is at the active tab. */
  async function openPopup(tab: Tab): Promise<Page> {
    const popup = await context.newPage();
    await popup.addInitScript((activeTab) => {
      chrome.tabs.query = () => Promise.resolve([activeTab]);
    }, tab);
    await popup.goto(`${extensionOrigin()}/popup.html`);
    return popup;
  }

  test('finds the sources on a page, connects to the app and sends the chosen one', async () => {
    test.skip(!bridgeRunning, `Port ${BRIDGE_PORT} is in use. Quit Open Video Downloader to run this test.`);

    // The app only listens to this extension, so its ID must be the one the app expects.
    expect(extensionOrigin()).toBe(EXTENSION_ORIGIN);

    const page = await context.newPage();
    await page.goto(`${origin}/watch`);
    const tab = await worker.evaluate(async (url) => {
      return (await chrome.tabs.query({})).find(t => t.url === url)!;
    }, `${origin}/watch`);

    const session = <T>(key: string) => worker.evaluate(async k => (await chrome.storage.session.get(k))[k], key) as Promise<T | undefined>;
    const stored = async () => await session<Source[]>(String(tab.id)) ?? [];
    const detected = async () => (await stored())
      .map(({ url, kind, drm, height, size }) => ({ path: new URL(url).pathname, kind, drm, height, size }))
      .sort((a, b) => a.path.localeCompare(b.path));
    const badge = () => worker.evaluate(tabId => chrome.action.getBadgeText({ tabId }), tab.id);

    // --- Detection ---------------------------------------------------------------------
    // The two quality variants fold into their master, and nothing else slips in. The stream
    // on the other site cannot be read without its Authorization header, so it stays unlabelled.
    const everything = [
      { path: '/auth/live.m3u8', kind: 'hls' },
      { path: '/clip.mp4', kind: 'file', size: 2 * 1024 * 1024 },
      { path: '/drm/manifest.mpd', kind: 'dash', drm: true, height: 2160 },
      { path: '/frame/ad.mpd', kind: 'dash', drm: false, height: 360 },
      { path: '/hls/master.m3u8', kind: 'hls', drm: false, height: 1080 },
    ];
    await expect.poll(detected).toEqual(everything);
    await expect.poll(badge).toBe('5');

    // The headers are those of the request itself, not of the permission check before it.
    const find = async (path: string) => (await stored()).find(source => new URL(source.url).pathname === path)!;
    const protectedStream = await find('/auth/live.m3u8');
    expect(protectedStream.headers).toContain('Authorization: Bearer token');
    expect(protectedStream.headers.some(header => /^access-control-/i.test(header))).toBe(false);
    // Who asked is recorded: the page for its own requests, the other site for its frame's.
    expect(protectedStream.initiator).toBe(origin);
    expect((await find('/frame/ad.mpd')).initiator).toBe(otherOrigin);

    // --- Connecting -----------------------------------------------------------------------
    // Until the user has connected the extension to the app, nothing can be sent.
    let popup = await openPopup(tab);
    let status = popup.getByRole('status');
    let rows = popup.getByRole('list').filter({ has: popup.getByRole('button', { name: /^Download now/ }) }).getByRole('listitem');
    await expect(popup.getByRole('heading', { name: 'Connect to the app' })).toBeVisible();
    await expect(popup.getByRole('button', { name: /^Download now/ })).toHaveCount(0);

    await popup.getByRole('button', { name: 'Connect' }).click();
    await expect(status).toContainText('Allow it, then paste the key below.');
    expect(received.map(request => request.path)).toEqual(['/pair']);

    // The toolbar popup closes when the app comes forward to ask. Opened again, it picks up
    // at the paste step.
    await popup.close();
    popup = await openPopup(tab);
    status = popup.getByRole('status');
    rows = popup.getByRole('list').filter({ has: popup.getByRole('button', { name: /^Download now/ }) }).getByRole('listitem');
    await expect(status).toContainText('Paste the key above and choose Finish.');
    await expect(popup.getByLabel(/paste the key/)).toBeFocused();

    // A key the app does not hold is refused.
    await popup.getByLabel(/paste the key/).fill('cd'.repeat(32));
    await popup.getByRole('button', { name: 'Finish' }).click();
    await expect(status).toContainText('That key does not match the app that is running.');
    await popup.getByLabel(/paste the key/).fill('not a key');
    await popup.getByRole('button', { name: 'Finish' }).click();
    await expect(status).toContainText('That is not a connection key.');

    await popup.getByLabel(/paste the key/).fill(APP_KEY);
    await popup.getByRole('button', { name: 'Finish' }).click();
    await expect(status).toHaveText('Connected to Open Video Downloader.');
    await expect(popup.getByRole('heading', { name: 'Connect to the app' })).toBeHidden();
    // The form that had the focus is gone; it moves to the first thing to do next.
    await expect(popup.getByRole('button', { name: 'Download now: Fixture Show' })).toBeFocused();

    // --- The list ------------------------------------------------------------------------------
    // The page first; then what the page itself loaded (streams by quality, files, DRM last);
    // then what a frame from another site loaded.
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(0)).toContainText('Fixture Show');
    await expect(rows.nth(1)).toContainText('HLS stream · up to 1080p');
    await expect(rows.nth(1)).not.toContainText('embedded');
    await expect(rows.nth(2)).toContainText('/auth/live.m3u8');
    await expect(rows.nth(3)).toContainText('Media file · 2.0 MB');
    await expect(rows.nth(4)).toContainText('DASH stream · up to 2160p');
    // DRM is a warning: the app has the final say, so the row can still be sent.
    await expect(rows.nth(4)).toContainText('DRM protected, download will likely fail');
    await expect(rows.nth(4).getByRole('button', { name: /^Download now/ })).toBeEnabled();
    await expect(rows.nth(1)).not.toContainText('DRM');
    await expect(rows.nth(5)).toContainText('DASH stream · up to 360p');
    await expect(rows.nth(5)).toContainText('/frame/ad.mpd · embedded from 127.0.0.1');

    // A source that turns up while the list is open goes to the end, even when it would rank
    // first: rows do not move under the pointer, and the keyboard focus stays where it was.
    const focused = rows.nth(3).getByRole('button', { name: /^Copy address/ });
    await focused.focus();
    await page.evaluate(() => fetch('/late/master.m3u8'));
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(6)).toContainText('HLS stream · up to 2160p');
    await expect(rows.nth(1)).toContainText('HLS stream · up to 1080p');
    await expect(focused).toBeFocused();
    const late = { path: '/late/master.m3u8', kind: 'hls', drm: false, height: 2160 };
    const withLate = [...everything.slice(0, 5), late];
    expect(await detected()).toEqual(withLate);

    // --- Sending -----------------------------------------------------------------------------
    // Queue the stream: it carries the page's cookies, the headers the browser used, and the page title.
    received.length = 0;
    await popup.getByRole('button', { name: /^Add to queue: HLS stream · up to 1080p/ }).click();
    await expect(status).toHaveText('Sent to Open Video Downloader.');
    // The app proved itself first, then got the link. No preflight: the extension may talk to the app's address.
    expect(received.map(request => `${request.method} ${request.path}`)).toEqual(['POST /hello', 'POST /add']);
    expect(received[1].headers.origin).toBe(EXTENSION_ORIGIN);
    expect(received[1].headers['content-type']).toBe('application/json');
    // The browser's own cookies for the app's address never go along, to the app or anything else there.
    expect(received.some(request => 'cookie' in request.headers)).toBe(false);
    const [queued] = added();
    expect(queued).toMatchObject({ url: `${origin}/hls/master.m3u8`, download: false, title: 'Fixture Show' });
    expect(queued.headers).toContain(`Referer: ${origin}/watch`);
    expect(queued.headers.some(header => /^(cookie|range|sec-)/i.test(header))).toBe(false);
    expect(queued.cookies).toContain('#HttpOnly_127.0.0.1\tFALSE\t/\tFALSE\t0\tsession\tabc\n');

    // A second stream from the same page keeps its Authorization header. The extension names it
    // after the page as well; giving it a number is the app's job (see uniqueTitle).
    await popup.getByRole('button', { name: /^Add to queue: HLS stream, / }).click();
    await expect.poll(() => added().length).toBe(2);
    await expect(status).toHaveText('Sent to Open Video Downloader.');
    expect(added()[1]).toMatchObject({ url: `${otherOrigin}/auth/live.m3u8`, title: 'Fixture Show' });
    expect(added()[1].headers).toContain('Authorization: Bearer token');
    // The browser sent no cookies with that request (it went to another site), so none of
    // that site's go along now; the page's own do, because the page itself loaded the stream.
    expect(added()[1].cookies).toContain('session\tabc');

    await popup.getByRole('button', { name: /^Download now: HLS stream · up to 1080p/ }).click();
    await expect.poll(() => added().length).toBe(3);
    await expect(status).toHaveText('Sent to Open Video Downloader.');
    expect(added()[2]).toMatchObject({ url: `${origin}/hls/master.m3u8`, download: true, title: 'Fixture Show' });

    // Download the page itself: the app works out the video and its title.
    await popup.getByRole('button', { name: 'Download now: Fixture Show' }).click();
    await expect.poll(() => added().length).toBe(4);
    await expect(status).toHaveText('Sent to Open Video Downloader.');
    expect(added()[3]).toMatchObject({ url: `${origin}/watch`, download: true });
    expect(added()[3].title).toBeUndefined();
    expect(added()[3].headers).toEqual([expect.stringMatching(/^User-Agent: /)]);

    // --- Something else on the app's port -------------------------------------------------
    // With the app closed, another program takes its port. It cannot prove it holds the key,
    // so it is told nothing: no link, and above all no cookies.
    await close(bridge);
    bridgeRunning = false;
    const overheard: Received[] = [];
    const impostor = createBridge(overheard, 'ef'.repeat(32));
    await listen(impostor, BRIDGE_PORT);
    await popup.getByRole('button', { name: 'Add to queue: Fixture Show' }).click();
    await expect(status).toContainText('does not recognize this browser');
    expect(overheard.map(request => request.path)).toEqual(['/hello']);
    expect(JSON.stringify(overheard)).not.toContain('session');
    await close(impostor);

    // With nothing on the port at all, say so.
    await popup.getByRole('button', { name: 'Add to queue: Fixture Show' }).click();
    await expect(status).toHaveText('Could not reach Open Video Downloader. Is it running?');

    // --- Moving on -----------------------------------------------------------------------------
    // The list belongs to the page. A new query on the same page keeps it, and starts a new
    // generation so that whatever loads next ranks first...
    const pageState = () => session<{ url: string; gen: number }>(`page:${tab.id}`);
    await page.evaluate(() => history.replaceState({}, '', '/watch?t=42'));
    await page.evaluate(() => history.pushState({}, '', '/watch?t=43'));
    await expect.poll(pageState).toMatchObject({ url: `${origin}/watch?t=43`, gen: 2 });
    expect(await detected()).toEqual(withLate);
    // ...a single-page site moving to another page clears it...
    await page.evaluate(() => history.pushState({}, '', '/another-video'));
    await expect.poll(detected).toEqual([]);
    await expect.poll(badge).toBe('');
    // ...and so does loading a page: the next one starts empty and fills up again.
    await page.goto(`${origin}/watch`);
    await expect.poll(detected).toEqual(everything);
    await page.goto(`${origin}/empty`);
    await expect.poll(detected).toEqual([]);
  });
});
