// Pure helpers shared by the service worker, the popup and detect.test.js.

// Pieces of a stream, not something to download on their own.
const SEGMENT = /\.(ts|m4s|m4f|cmfv|cmfa|aac|vtt|key)$/i;
const MEDIA_FILE = /\.(mp4|m4v|mov|webm|mkv|flv|avi|mp3|m4a|flac|ogg|oga|opus|wav)$/i;
const MIN_FILE_BYTES = 1 << 20;
// What a server says when it does not know what it is serving: one of these, or nothing.
const GENERIC_TYPE = /^(text\/plain|application\/octet-stream|binary\/octet-stream)?\s*(;|$)/i;

// Headers that describe one browser request rather than the session, that only mean
// something to a browser, or that yt-dlp reads as instructions to itself (ytdl-*).
// Cookies travel separately, as a cookie file.
const DROP_HEADER = /^(cookie|range|host|content-length|content-type|accept-encoding|connection|if-.*|sec-.*|priority|pragma|cache-control|te|upgrade-insecure-requests|proxy-.*|access-control-.*|x-client-data|x-browser-.*|ytdl-.*|youtubedl-.*)$/i;
// The names yt-dlp accepts for `--add-header`, and the values it can send.
const HEADER_NAME = /^[A-Za-z0-9_-]+$/;
const HEADER_VALUE = /^[ -~]+$/;
// A page chooses its request headers; these keep what is stored and sent small.
const MAX_HEADERS = 40;
const MAX_HEADER_CHARS = 4096;
// All of them together; the app refuses a request with more than 16 KiB of headers.
const MAX_HEADERS_CHARS = 12 << 10;
const MAX_COOKIE_NAMES = 100;

/** @returns {'hls' | 'dash' | 'file' | null} what a response is, if it is a video source */
export function classify({ url, type, contentType = '', size }) {
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  if (/mpegurl/i.test(contentType) || /\.m3u8$/i.test(path)) return 'hls';
  if (/dash\+xml/i.test(contentType) || /\.mpd$/i.test(path)) return 'dash';
  if (SEGMENT.test(path) || /mp2t/i.test(contentType)) return null;
  const isMedia = type === 'media'
    || /^(video|audio)\//i.test(contentType)
    || (MEDIA_FILE.test(path) && GENERIC_TYPE.test(contentType));
  // Unknown size passes: a <video> element streaming a file often has none.
  return isMedia && !(size < MIN_FILE_BYTES) ? 'file' : null;
}

/**
 * Same stream requested again (new range, new signature) is the same source. Who asked
 * for it is part of its identity: what a frame from another site requests can then
 * never replace, refresh or hide what the page itself requested.
 */
export function sourceKey({ url, kind, initiator = '' }) {
  const { origin, pathname } = new URL(url);
  return `${kind} ${initiator} ${origin}${pathname}`;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Whether the page itself asked for this source, rather than a frame from another site. */
export function isOwn(source, pageUrl) {
  return source.initiator === originOf(pageUrl);
}

/** A page address for the app's own extractors to work out. */
export function pageSource(url, userAgent) {
  // Cloudflare-style clearance cookies only work with the browser's user agent.
  return { url, headers: [`User-Agent: ${userAgent}`] };
}

/** webRequest headers -> yt-dlp `--add-header` values. */
export function pickHeaders(requestHeaders = []) {
  return requestHeaders
    .filter(h => HEADER_NAME.test(h.name) && !DROP_HEADER.test(h.name) && HEADER_VALUE.test(h.value ?? ''))
    .map(h => `${h.name}: ${h.value}`)
    .filter(header => header.length <= MAX_HEADER_CHARS)
    .slice(0, MAX_HEADERS)
    .filter((header, i, headers) => headers.slice(0, i + 1).join('').length <= MAX_HEADERS_CHARS);
}

/**
 * The names of the cookies a request carried, or undefined when its headers were not seen.
 * Only those are passed on for the source later: the browser may hold more cookies for
 * that address than it was willing to send from this page.
 */
export function cookieNames(requestHeaders) {
  if (!requestHeaders) return undefined;
  const cookie = requestHeaders.find(h => h.name.toLowerCase() === 'cookie')?.value ?? '';
  const names = cookie.split(';').map(pair => pair.split('=')[0].trim()).filter(Boolean);
  return [...new Set(names)].slice(0, MAX_COOKIE_NAMES);
}

/**
 * Headers to send to the app for a source. The captured ones are best; they are missing
 * when the extension started while the request was already under way, so fall back to
 * the two that servers check most.
 */
export function headersFor({ headers = [] }, pageUrl, userAgent) {
  if (headers.length) return headers;
  const fallback = [`User-Agent: ${userAgent}`];
  if (/^https?:/.test(pageUrl ?? '')) fallback.push(`Referer: ${new URL(pageUrl).origin}/`);
  return fallback;
}

/**
 * A cookie partitioned under another site than the page's is one the browser would not
 * send from this tab, so the app should not either.
 */
export function inPartition(cookie, pageUrl) {
  const site = cookie.partitionKey?.topLevelSite;
  if (!site) return true;
  try {
    const page = new URL(pageUrl);
    const top = new URL(site);
    return page.protocol === top.protocol
      && (page.hostname === top.hostname || page.hostname.endsWith(`.${top.hostname}`));
  } catch {
    return false;
  }
}

/** chrome.cookies objects -> Netscape cookie file text, '' when there are none. */
export function toNetscape(cookies) {
  const seen = new Set();
  const lines = [];
  for (const c of cookies) {
    // The format is tab-separated lines; a cookie it cannot hold would corrupt its neighbours.
    if (/[\t\r\n]/.test(c.domain + c.path + c.name + c.value)) continue;
    const id = `${c.domain}\t${c.path}\t${c.name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    lines.push([
      (c.httpOnly ? '#HttpOnly_' : '') + c.domain,
      c.domain.startsWith('.') ? 'TRUE' : 'FALSE',
      c.path,
      c.secure ? 'TRUE' : 'FALSE',
      Math.floor(c.expirationDate ?? 0),
      c.name,
      c.value,
    ].join('\t'));
  }
  return lines.length ? ['# Netscape HTTP Cookie File', ...lines, ''].join('\n') : '';
}

// --- Manifests -----------------------------------------------------------------
// These read text a web page controls, so every pattern here must stay linear in
// the input: work line by line, or bound the repetition.

const MAX_LINE = 4096;
const MAX_VARIANTS = 200;
// 8K. A manifest claiming more is lying, most likely to be ranked first.
const MAX_HEIGHT = 4320;
// Sticky: each attribute must start where the last one ended, so no position is tried twice.
const ATTRIBUTE = /([A-Z0-9-]+)=("[^"]*"|[^",]*)(?:,|$)/y;

/** `A=1,B="x,y"` -> { A: '1', B: 'x,y' }. Stops at the first thing that is not an attribute. */
function attributes(list) {
  const found = {};
  ATTRIBUTE.lastIndex = 0;
  for (let m; (m = ATTRIBUTE.exec(list));) found[m[1]] = m[2].replace(/^"|"$/g, '');
  return found;
}

const maxOf = numbers => Math.max(0, ...numbers.filter(n => n <= MAX_HEIGHT)) || undefined;

function inspectHls(text, baseUrl) {
  const lines = text.split(/\r?\n/).map(line => line.trim().slice(0, MAX_LINE));
  const tag = name => lines
    .filter(line => line.startsWith(`${name}:`))
    .map(line => attributes(line.slice(name.length + 1)));

  // A key the browser can only use through its DRM module: a FairPlay key address or a
  // named key system. A plain key address (AES-128, or SAMPLE-AES with an ordinary key)
  // is encryption yt-dlp and ffmpeg can undo.
  const keys = [...tag('#EXT-X-KEY'), ...tag('#EXT-X-SESSION-KEY')];
  const drm = lines.some(line => line.startsWith('#EXT-X-FAXS-CM:'))
    || keys.some(key => /^skd:/i.test(key.URI ?? '')
      || Boolean(key.KEYFORMAT && key.KEYFORMAT.toLowerCase() !== 'identity'));

  const streams = tag('#EXT-X-STREAM-INF');
  const uris = streams.length === 0
    ? []
    : [
        ...lines.filter(line => line && !line.startsWith('#')),
        ...[...tag('#EXT-X-MEDIA'), ...tag('#EXT-X-I-FRAME-STREAM-INF')].map(media => media.URI).filter(Boolean),
      ];
  return {
    drm,
    height: maxOf(streams.map(stream => Number(/x(\d+)$/.exec(stream.RESOLUTION ?? '')?.[1] ?? 0))),
    variants: uris.slice(0, MAX_VARIANTS).filter(uri => URL.canParse(uri, baseUrl)).map(uri => new URL(uri, baseUrl).href),
  };
}

/** Removes XML comments in one pass. */
function withoutComments(xml) {
  return xml.split('<!--').map((part, i) => {
    if (i === 0) return part;
    const end = part.indexOf('-->');
    return end < 0 ? '' : part.slice(end + 3);
  }).join('');
}

function inspectDash(text) {
  const xml = withoutComments(text);
  const heights = xml.matchAll(/<(?:\w{1,32}:)?Representation\s[^>]{0,2000}?\bheight=["'](\d{1,5})["']/g);
  return {
    // yt-dlp refuses anything that declares protection, whichever scheme it is.
    drm: /<(?:\w{1,32}:)?ContentProtection[\s/>]/.test(xml),
    height: maxOf([...heights].map(m => Number(m[1]))),
    variants: [],
  };
}

/**
 * Reads an HLS or DASH manifest.
 * @returns {{ drm: boolean, height?: number, variants: string[] }} `variants`
 *   are the playlists an HLS master points at, as absolute URLs.
 */
export function inspectManifest(kind, text, baseUrl) {
  return kind === 'dash' ? inspectDash(text) : inspectHls(text.replace(/^﻿/, ''), baseUrl);
}

// --- A tab's list of sources ----------------------------------------------------------

/**
 * Best candidate first: what the page itself loaded before what a frame from another site
 * did, then what loaded most recently (see `gen`), downloadable, streams over files, and
 * quality and size.
 */
export function rank(sources, pageUrl) {
  const foreign = source => (pageUrl === undefined ? 0 : Number(!isOwn(source, pageUrl)));
  return [...sources].sort((a, b) =>
    foreign(a) - foreign(b)
    || (b.gen ?? 0) - (a.gen ?? 0)
    || Boolean(a.drm) - Boolean(b.drm)
    || (a.kind === 'file') - (b.kind === 'file')
    || (b.height ?? 0) - (a.height ?? 0)
    || (b.size ?? 0) - (a.size ?? 0),
  );
}

/**
 * What to send when the user has not picked a row: the best downloadable stream the page
 * itself loaded. A frame from another site (an advert, say) cannot volunteer one, and plain
 * media files are left to the popup, where the user can tell a real video from a fragment.
 */
export function bestStream(sources, pageUrl) {
  return rank(sources, pageUrl).find(source => source.kind !== 'file' && !source.drm && isOwn(source, pageUrl));
}

/** The source a right-click menu entry stands for. */
export function menuSource(info, pageUrl, sources, userAgent) {
  if (info.menuItemId === 'link') return pageSource(info.linkUrl, userAgent);
  if (info.menuItemId === 'media') {
    const frame = info.frameUrl ?? info.pageUrl;
    // The same address may have been requested by several frames: prefer this one's.
    const detected = sources.filter(source => source.url === info.srcUrl);
    const here = detected.find(source => source.initiator === originOf(frame)) ?? detected[0];
    if (here) return here;
    if (/^https?:/.test(info.srcUrl ?? '')) {
      return { url: info.srcUrl, kind: 'file', initiator: originOf(frame) ?? '', headers: headersFor({}, frame, userAgent) };
    }
    // Players fed by script have a blob: address; use what the network showed instead.
    const stream = bestStream(sources, pageUrl);
    if (stream) return stream;
  }
  return pageSource(pageUrl, userAgent);
}

/** A short fingerprint of a string: small to store, and only ever compared within one frame's sources. */
function fingerprint(text) {
  let a = 0x811c9dc5;
  let b = 0x9747b28c;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/** A source without who asked: the part of its identity a manifest can name. */
const streamOf = url => fingerprint(sourceKey({ kind: 'hls', url }));

/** Whether `source` is a quality variant of `master`, which the same frame loaded. */
function isVariantOf(master, source) {
  if (master.initiator !== source.initiator) return false;
  return Boolean(master.variants?.includes(streamOf(source.url)) || master.variantUrls?.includes(fingerprint(source.url)));
}

/**
 * Adds a detected source to a tab's list, or refreshes the one already there.
 * @param pageOrigin the origin of the page in the tab, whose own sources are kept the longest
 * @returns {{ list: object[], added: boolean, moved?: boolean } | null} null when nothing
 *   changed; `moved` when a known stream came back with a new address after the page moved on
 */
export function addSource(list, source, max, pageOrigin) {
  const id = sourceKey(source);
  // A quality variant of a stream that is already listed.
  if (list.some(s => isVariantOf(s, source))) return null;

  const index = list.findIndex(s => sourceKey(s) === id);
  if (index >= 0) {
    // The same stream requested again. Its newest address and headers are the ones still
    // valid (signatures expire); what was learned about it stays.
    const known = list[index];
    const next = { ...known, ...source, headers: source.headers?.length ? source.headers : known.headers };
    for (const kept of ['size', 'cookieNames']) {
      const value = source[kept] ?? known[kept];
      if (value === undefined) delete next[kept];
      else next[kept] = value;
    }
    const same = known.url === next.url && known.gen === next.gen && known.size === next.size
      && String(known.headers) === String(next.headers) && String(known.cookieNames) === String(next.cookieNames);
    if (same) return null;
    // On a single-page site this can be the next video at the same path: read it again.
    const moved = known.url !== next.url && known.gen !== next.gen;
    return { list: list.with(index, next), added: false, moved };
  }

  let kept = list;
  if (list.length >= max) {
    // Full. The page's own sources stay as long as anything else is listed: frames from
    // other sites must not be able to push them out. Among the rest, whoever has the most
    // entries is the one filling the list, so one of theirs goes: the oldest file first,
    // which is more likely a stream fragment than the video.
    const foreign = list.filter(s => s.initiator !== pageOrigin);
    if (!foreign.length && pageOrigin !== undefined && source.initiator !== pageOrigin) return null;
    const pool = foreign.length ? foreign : list;
    const counts = new Map();
    for (const s of pool) counts.set(s.initiator, (counts.get(s.initiator) ?? 0) + 1);
    const busiest = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const theirs = pool.filter(s => s.initiator === busiest);
    const victim = theirs.find(s => s.kind === 'file') ?? theirs[0];
    kept = list.filter(s => s !== victim);
  }
  return { list: [...kept, source], added: true };
}

/**
 * Records what reading a manifest told us, and folds the stream's quality variants into it.
 * Variants are matched among requests from the same frame only, so a frame cannot name the
 * page's own stream as its variant to hide it.
 * @returns {object[] | null} the new list, or null when the source is no longer listed
 */
export function applyInspection(list, source, info) {
  const id = sourceKey(source);
  const index = list.findIndex(s => sourceKey(s) === id);
  if (index < 0) return null;
  const own = streamOf(source.url);
  const variantUrls = info.variants.filter(url => streamOf(url) === own && url !== source.url).map(fingerprint);
  // While the manifest was being read, the player may have asked for a variant at the same
  // path (told apart by its query only), which looked like the stream itself being asked
  // for again and took over its address. Give the stream its own address back.
  const overwritten = variantUrls.includes(fingerprint(list[index].url))
    ? { url: source.url, headers: source.headers, cookieNames: source.cookieNames }
    : {};
  const entry = {
    ...list[index],
    ...overwritten,
    drm: info.drm,
    height: info.height,
    variants: info.variants.map(streamOf).filter(stream => stream !== own),
    // Variants at the stream's own path, told apart by their query only: known by full address.
    variantUrls,
  };
  return list.with(index, entry).filter(s => s === entry || !isVariantOf(entry, s));
}

// --- Talking to the app ---------------------------------------------------------------

/** HMAC-SHA256 as lowercase hex, the same as `hmac_hex` in src-tauri/src/bridge.rs. */
export async function hmacHex(key, message) {
  const encoder = new TextEncoder();
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), algorithm, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
