// Run with: npm run test:extension
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addSource, applyInspection, bestStream, classify, cookieNames, headersFor, hmacHex, inPartition,
  inspectManifest, isOwn, menuSource, pageSource, pickHeaders, rank, sourceKey, toNetscape,
} from './detect.js';

test('classify finds manifests and files, skips segments and small clips', () => {
  assert.equal(classify({ url: 'https://a.test/x/master.m3u8?t=1', type: 'xmlhttprequest' }), 'hls');
  assert.equal(classify({ url: 'https://a.test/api/play', contentType: 'application/vnd.apple.mpegurl' }), 'hls');
  assert.equal(classify({ url: 'https://a.test/api/play', contentType: 'application/x-mpegURL' }), 'hls');
  assert.equal(classify({ url: 'https://a.test/x.mpd', type: 'xmlhttprequest' }), 'dash');
  assert.equal(classify({ url: 'https://a.test/v.mp4', type: 'media' }), 'file');
  assert.equal(classify({ url: 'https://a.test/v', contentType: 'video/mp4', size: 5e6 }), 'file');
  assert.equal(classify({ url: 'https://a.test/v', contentType: 'video/mp4', size: 2000 }), null);
  assert.equal(classify({ url: 'https://a.test/seg1.ts', contentType: 'video/mp2t', size: 5e6 }), null);
  assert.equal(classify({ url: 'https://a.test/seg1.m4s', type: 'xmlhttprequest', contentType: 'video/mp4' }), null);
  assert.equal(classify({ url: 'https://a.test/page', contentType: 'text/html' }), null);
  assert.equal(classify({ url: 'not a url', type: 'media' }), null);
});

test('classify trusts a media file name when the server gives no real type', () => {
  const file = { url: 'https://a.test/v.mp4', type: 'xmlhttprequest', size: 5e6 };
  assert.equal(classify({ ...file, contentType: 'application/octet-stream' }), 'file');
  assert.equal(classify({ ...file, contentType: 'text/plain; charset=utf-8' }), 'file');
  assert.equal(classify(file), 'file');
  assert.equal(classify({ ...file, contentType: 'text/html' }), null);
  assert.equal(classify({ ...file, contentType: 'application/json' }), null);
});

test('classify treats an empty response as too small, and an unknown size as possibly a video', () => {
  assert.equal(classify({ url: 'https://a.test/v.mp4', type: 'media', size: 0 }), null);
  assert.equal(classify({ url: 'https://a.test/v.mp4', type: 'media', size: undefined }), 'file');
});

test('sourceKey ignores the query string, and tells apart who asked', () => {
  assert.equal(
    sourceKey({ kind: 'file', url: 'https://a.test/v.mp4?sig=1' }),
    sourceKey({ kind: 'file', url: 'https://a.test/v.mp4?sig=2' }),
  );
  assert.notEqual(
    sourceKey({ kind: 'hls', url: 'https://cdn.test/v.m3u8', initiator: 'https://a.test' }),
    sourceKey({ kind: 'hls', url: 'https://cdn.test/v.m3u8', initiator: 'https://ads.test' }),
  );
});

test('isOwn is true only for what the page itself asked for', () => {
  const page = 'https://a.test/watch?v=1';
  assert.equal(isOwn({ initiator: 'https://a.test' }, page), true);
  assert.equal(isOwn({ initiator: 'https://ads.test' }, page), false);
  assert.equal(isOwn({ initiator: '' }, page), false);
  assert.equal(isOwn({ initiator: 'null' }, page), false);
  assert.equal(isOwn({ initiator: 'https://a.test' }, 'not a url'), false);
});

test('pickHeaders keeps session headers and drops per-request, browser-only and unsafe ones', () => {
  const headers = pickHeaders([
    { name: 'Referer', value: 'https://a.test/' },
    { name: 'Authorization', value: 'Bearer x' },
    { name: 'X-Custom_1', value: 'v' },
    { name: 'Cookie', value: 'a=b' },
    { name: 'Range', value: 'bytes=0-' },
    { name: 'sec-fetch-mode', value: 'cors' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Access-Control-Request-Headers', value: 'authorization' },
    { name: 'Proxy-Authorization', value: 'Basic x' },
    { name: 'X-Client-Data', value: 'abc' },
    // yt-dlp would take these as instructions to itself.
    { name: 'Ytdl-Request-Proxy', value: 'http://evil.test:8080' },
    { name: 'youtubedl-no-compression', value: '1' },
    // yt-dlp rejects names like this one.
    { name: 'x.dotted', value: 'v' },
    { name: 'Empty', value: '' },
    // yt-dlp can only send printable ASCII.
    { name: 'X-Name', value: 'caf\u00e9' },
    { name: 'X-Huge', value: 'v'.repeat(5000) },
  ]);
  assert.deepEqual(headers, ['Referer: https://a.test/', 'Authorization: Bearer x', 'X-Custom_1: v']);
  assert.deepEqual(pickHeaders(undefined), []);
  // A page cannot make the list of headers arbitrarily long, or longer in all than the app accepts.
  const many = Array.from({ length: 500 }, (_, i) => ({ name: `X-${i}`, value: 'v' }));
  assert.equal(pickHeaders(many).length, 40);
  const big = Array.from({ length: 10 }, (_, i) => ({ name: `X-${i}`, value: 'v'.repeat(4000) }));
  assert.ok(pickHeaders(big).join('').length <= 12 * 1024);
  assert.equal(pickHeaders(big).length, 3);
});

test('cookieNames lists the cookies a request carried', () => {
  assert.deepEqual(cookieNames([{ name: 'Cookie', value: 'sid=abc; theme=dark;  sid=again' }]), ['sid', 'theme']);
  // A request that carried none is not the same as one whose headers were never seen.
  assert.deepEqual(cookieNames([{ name: 'Accept', value: '*/*' }]), []);
  assert.equal(cookieNames(undefined), undefined);
  const flood = Array.from({ length: 500 }, (_, i) => `c${i}=1`).join('; ');
  assert.equal(cookieNames([{ name: 'cookie', value: flood }]).length, 100);
});

test('headersFor prefers captured headers and falls back to user agent and referer', () => {
  const captured = ['Referer: https://a.test/watch/1', 'Authorization: Bearer x'];
  assert.deepEqual(headersFor({ headers: captured }, 'https://a.test/watch/1', 'UA'), captured);
  assert.deepEqual(headersFor({ headers: [] }, 'https://a.test/watch/1?x=1', 'UA'), ['User-Agent: UA', 'Referer: https://a.test/']);
  assert.deepEqual(headersFor({}, 'chrome://newtab/', 'UA'), ['User-Agent: UA']);
  assert.deepEqual(headersFor({}, undefined, 'UA'), ['User-Agent: UA']);
});

test('inPartition keeps ordinary cookies and those partitioned under the page\'s site', () => {
  const page = 'https://www.shop.test/watch';
  assert.equal(inPartition({}, page), true);
  assert.equal(inPartition({ partitionKey: {} }, page), true);
  assert.equal(inPartition({ partitionKey: { topLevelSite: 'https://shop.test' } }, page), true);
  assert.equal(inPartition({ partitionKey: { topLevelSite: 'https://other.test' } }, page), false);
  assert.equal(inPartition({ partitionKey: { topLevelSite: 'https://notshop.test' } }, 'https://shop.test/'), false);
  assert.equal(inPartition({ partitionKey: { topLevelSite: 'http://shop.test' } }, page), false);
  assert.equal(inPartition({ partitionKey: { topLevelSite: 'not a site' } }, page), false);
});

test('toNetscape writes one line per unique cookie', () => {
  const cookie = { domain: '.a.test', path: '/', secure: true, httpOnly: true, expirationDate: 1900000000.5, name: 'sid', value: 'v' };
  const session = { domain: 'a.test', path: '/', secure: false, httpOnly: false, name: 's', value: '1' };
  const unwritable = { ...session, name: 'tabbed', value: 'a\tb' };
  assert.equal(
    toNetscape([cookie, cookie, session, unwritable]),
    '# Netscape HTTP Cookie File\n'
    + '#HttpOnly_.a.test\tTRUE\t/\tTRUE\t1900000000\tsid\tv\n'
    + 'a.test\tFALSE\t/\tFALSE\t0\ts\t1\n',
  );
  assert.equal(toNetscape([]), '');
});

test('inspectManifest reads quality and variants from an HLS master', () => {
  const master = [
    '#EXTM3U',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="English, stereo",URI="audio/en.m3u8"',
    '#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"',
    'v/720.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2,RESOLUTION=1920x1080',
    'https://cdn.test/1080.m3u8?t=1',
  ];
  const expected = {
    drm: false,
    height: 1080,
    variants: ['https://a.test/x/v/720.m3u8', 'https://cdn.test/1080.m3u8?t=1', 'https://a.test/x/audio/en.m3u8'],
  };
  assert.deepEqual(inspectManifest('hls', master.join('\n'), 'https://a.test/x/master.m3u8'), expected);
  // Windows line endings and a byte order mark change nothing.
  assert.deepEqual(inspectManifest('hls', `﻿${master.join('\r\n')}\r\n`, 'https://a.test/x/master.m3u8'), expected);
});

test('inspectManifest tells HLS DRM from ordinary encryption', () => {
  const hls = key => inspectManifest('hls', `#EXTM3U\n${key}\n#EXTINF:4,\nseg.ts`, 'https://a.test/v.m3u8');
  // Encryption yt-dlp and ffmpeg can undo.
  assert.equal(hls('#EXT-X-KEY:METHOD=NONE').drm, false);
  assert.equal(hls('#EXT-X-KEY:METHOD=AES-128,URI="https://a.test/key"').drm, false);
  assert.equal(hls('#EXT-X-KEY:METHOD=AES-128,URI="https://k.test/key.php?method=get&KEYFORMAT=x"').drm, false);
  assert.equal(hls('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="https://a.test/key",KEYFORMAT="identity"').drm, false);
  // Keys only the browser's DRM module can use.
  assert.equal(hls('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://key"').drm, true);
  assert.equal(hls('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="data:x",KEYFORMAT="com.apple.streamingkeydelivery"').drm, true);
  assert.equal(hls('#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"').drm, true);
  assert.equal(hls('#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,KEYFORMAT="com.microsoft.playready"').drm, true);
  assert.equal(hls('#EXT-X-FAXS-CM:abc').drm, true);
  // A media playlist has no variants.
  assert.deepEqual(hls('#EXT-X-KEY:METHOD=NONE').variants, []);
});

test('inspectManifest does not believe an impossible quality, or follow endless variants', () => {
  const stream = height => `#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1x${height}\nv${height}.m3u8`;
  const master = `#EXTM3U\n${stream(720)}\n${stream(99999)}`;
  assert.equal(inspectManifest('hls', master, 'https://a.test/m.m3u8').height, 720);
  assert.equal(inspectManifest('dash', '<MPD><Representation id="1" height="99999"/></MPD>', 'https://a.test/x.mpd').height, undefined);

  const many = `#EXTM3U\n${Array.from({ length: 500 }, (_, i) => stream(100 + i)).join('\n')}`;
  assert.equal(inspectManifest('hls', many, 'https://a.test/m.m3u8').variants.length, 200);
});

test('inspectManifest reads quality and protection from a DASH manifest', () => {
  const mpd = body => inspectManifest('dash', `<MPD><AdaptationSet>${body}</AdaptationSet></MPD>`, 'https://a.test/x.mpd');
  assert.deepEqual(
    mpd('<Representation id="1" height="480"/><Representation id="2" width="3840" height="2160"/>'),
    { drm: false, height: 2160, variants: [] },
  );
  assert.equal(mpd(`<Representation id='1' height='720'/>`).height, 720);
  assert.equal(mpd('<ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/>').drm, true);
  assert.equal(mpd('<mpd:ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011"/>').drm, true);
  // Mentioned in a comment only.
  assert.equal(mpd('<!-- <ContentProtection/> --><Representation id="1" height="720"/>').drm, false);
  assert.equal(mpd('<!-- never closed <ContentProtection/>').drm, false);
});

test('inspectManifest stays fast on text built to slow it down', () => {
  const start = performance.now();
  inspectManifest('hls', '#EXT-X-KEY:'.repeat(90_000), 'https://a.test/v.m3u8');
  inspectManifest('hls', `#EXTM3U\n#EXT-X-KEY:${'A="'.repeat(300_000)}`, 'https://a.test/v.m3u8');
  inspectManifest('hls', '#EXT-X-MEDIA:'.repeat(80_000), 'https://a.test/v.m3u8');
  // An attribute name that never ends, on many lines.
  inspectManifest('hls', `#EXT-X-STREAM-INF:${'A'.repeat(4096)}\n`.repeat(250), 'https://a.test/v.m3u8');
  inspectManifest('hls', `#EXT-X-KEY:${'A=1,'.repeat(1000)}${'B'.repeat(96)}\n`.repeat(250), 'https://a.test/v.m3u8');
  inspectManifest('dash', '<!--'.repeat(250_000), 'https://a.test/v.mpd');
  inspectManifest('dash', '<Representation '.repeat(60_000), 'https://a.test/v.mpd');
  inspectManifest('dash', `<Representation ${'a'.repeat(1_000_000)}`, 'https://a.test/v.mpd');
  // Each of these is about 1 MB, the most the extension reads. Quadratic matching took seconds.
  assert.ok(performance.now() - start < 1000, `took ${Math.round(performance.now() - start)} ms`);
});

test('rank puts what loaded last first, then downloadable streams, and DRM last', () => {
  const sources = [
    { url: 'drm', kind: 'hls', drm: true, height: 2160 },
    { url: 'small', kind: 'file', size: 2e6 },
    { url: 'big', kind: 'file', size: 9e6 },
    { url: 'sd', kind: 'hls', height: 480 },
    { url: 'hd', kind: 'dash', height: 1080 },
  ];
  assert.deepEqual(rank(sources).map(s => s.url), ['hd', 'sd', 'big', 'small', 'drm']);

  // A single-page site moved on to the next video: its stream ranks above the better one
  // left over from the last video.
  const moved = [{ url: 'previous', kind: 'hls', height: 2160, gen: 0 }, { url: 'current', kind: 'hls', height: 720, gen: 1 }];
  assert.deepEqual(rank(moved).map(s => s.url), ['current', 'previous']);
});

test('rank puts what the page itself loaded before what frames from other sites loaded', () => {
  const page = 'https://a.test/watch';
  const sources = [
    // A frame claiming the best quality and the newest generation still comes second.
    { url: 'frame', initiator: 'https://ads.test', kind: 'hls', height: 4320, gen: 9 },
    { url: 'file', initiator: 'https://a.test', kind: 'file', size: 2e6, gen: 0 },
    { url: 'stream', initiator: 'https://a.test', kind: 'hls', height: 720, gen: 0 },
  ];
  assert.deepEqual(rank(sources, page).map(s => s.url), ['stream', 'file', 'frame']);
});

test('bestStream picks a downloadable stream the page itself loaded', () => {
  const page = 'https://a.test/watch';
  const own = { initiator: 'https://a.test' };
  const file = { ...own, url: 'https://a.test/v.mp4', kind: 'file', size: 9e9 };
  const drm = { ...own, url: 'https://a.test/drm.mpd', kind: 'dash', drm: true, height: 2160 };
  const stream = { ...own, url: 'https://cdn.test/v.m3u8', kind: 'hls', height: 720 };
  // An advert's frame offers a "better" stream; it is never the automatic pick.
  const planted = { initiator: 'https://ads.test', url: 'https://ads.test/x.m3u8', kind: 'hls', height: 4320 };
  assert.equal(bestStream([file, drm, planted, stream], page), stream);
  assert.equal(bestStream([file, drm, planted], page), undefined);
  assert.equal(bestStream([], page), undefined);
});

test('menuSource chooses what a right-click entry sends', () => {
  const page = 'https://a.test/watch';
  const stream = { initiator: 'https://a.test', url: 'https://cdn.test/v.m3u8', kind: 'hls', headers: ['Referer: https://a.test/watch'] };
  const sources = [stream];
  const pageItself = { url: page, headers: ['User-Agent: UA'] };

  assert.deepEqual(menuSource({ menuItemId: 'page' }, page, sources, 'UA'), pageItself);
  assert.deepEqual(pageSource(page, 'UA'), pageItself);
  assert.deepEqual(
    menuSource({ menuItemId: 'link', linkUrl: 'https://b.test/video' }, page, sources, 'UA'),
    { url: 'https://b.test/video', headers: ['User-Agent: UA'] },
  );
  // A video element whose address was seen on the network: that source, headers and all.
  assert.equal(menuSource({ menuItemId: 'media', srcUrl: stream.url, pageUrl: page }, page, sources, 'UA'), stream);
  // The same address also requested by a frame: the one from where the click was.
  const framed = { ...stream, initiator: 'https://player.test', headers: ['Referer: https://player.test/'] };
  const click = { menuItemId: 'media', srcUrl: stream.url, pageUrl: page };
  assert.equal(menuSource(click, page, [framed, stream], 'UA'), stream);
  assert.equal(menuSource({ ...click, frameUrl: 'https://player.test/embed/1' }, page, [stream, framed], 'UA'), framed);
  // One that was not seen: its address, as a file loaded by the frame it sits in.
  assert.deepEqual(
    menuSource({ menuItemId: 'media', srcUrl: 'https://b.test/v.mp4', pageUrl: page, frameUrl: 'https://player.test/embed/1' }, page, sources, 'UA'),
    { url: 'https://b.test/v.mp4', kind: 'file', initiator: 'https://player.test', headers: ['User-Agent: UA', 'Referer: https://player.test/'] },
  );
  // A player fed by script (blob: address): the stream the page loaded, or else the page.
  assert.equal(menuSource({ menuItemId: 'media', srcUrl: 'blob:https://a.test/1', pageUrl: page }, page, sources, 'UA'), stream);
  assert.deepEqual(menuSource({ menuItemId: 'media', srcUrl: 'blob:https://a.test/1', pageUrl: page }, page, [], 'UA'), pageItself);
});

test('addSource adds new sources and skips ones it already has', () => {
  const master = { url: 'https://a.test/master.m3u8?t=1', kind: 'hls', headers: ['Referer: https://a.test/'], gen: 0 };
  const added = addSource([], master, 50);
  assert.deepEqual(added, { list: [master], added: true });
  assert.equal(addSource(added.list, { ...master }, 50), null);
});

test('addSource refreshes a stream requested again, keeping what was learned', () => {
  const known = { url: 'https://a.test/live.m3u8?token=old', kind: 'hls', headers: ['Referer: https://a.test/'], cookieNames: ['sid'], gen: 0, drm: false, height: 720, variants: [] };
  const again = { url: 'https://a.test/live.m3u8?token=new', kind: 'hls', headers: ['Referer: https://a.test/', 'Authorization: Bearer x'], cookieNames: ['sid', 'cdn'], gen: 0 };
  assert.deepEqual(addSource([known], again, 50), {
    list: [{ ...known, url: again.url, headers: again.headers, cookieNames: again.cookieNames }],
    added: false,
    moved: false,
  });
  // A request seen without its headers does not erase the ones already captured...
  const bare = { url: 'https://a.test/live.m3u8?token=newer', kind: 'hls', headers: [], cookieNames: undefined, gen: 0 };
  const [kept] = addSource([known], bare, 50).list;
  assert.deepEqual(kept.headers, known.headers);
  assert.deepEqual(kept.cookieNames, known.cookieNames);
  // ...and one without a length does not erase the size.
  const file = { url: 'https://a.test/v.mp4?sig=1', kind: 'file', headers: [], gen: 0, size: 5e6 };
  const partial = { url: 'https://a.test/v.mp4?sig=2', kind: 'file', headers: [], gen: 0, size: undefined };
  assert.equal(addSource([file], partial, 50).list[0].size, 5e6);
});

test('addSource says when a known stream came back with a new address after the page moved on', () => {
  // A single-page site playing the next video from the same path: it needs reading again.
  const known = { url: 'https://a.test/play.m3u8?v=1', kind: 'hls', headers: [], gen: 0, drm: true, height: 2160 };
  assert.equal(addSource([known], { ...known, url: 'https://a.test/play.m3u8?v=2', gen: 1 }, 50).moved, true);
  // The same video with a fresh signature, or the same address seen again later, does not.
  assert.equal(addSource([known], { ...known, url: 'https://a.test/play.m3u8?v=1&sig=2' }, 50).moved, false);
  assert.equal(addSource([known], { ...known, gen: 1 }, 50).moved, false);
});

test('addSource does not let a frame from another site touch the page\'s sources', () => {
  const real = { initiator: 'https://a.test', url: 'https://cdn.test/v.m3u8?token=real', kind: 'hls', headers: ['Referer: https://a.test/'], gen: 0 };
  const forged = { initiator: 'https://ads.test', url: 'https://cdn.test/v.m3u8?token=forged', kind: 'hls', headers: [], gen: 0 };
  // Same address, different asker: a second row, and the real one is unchanged.
  assert.deepEqual(addSource([real], forged, 50), { list: [real, forged], added: true });
});

test('addSource makes room in a full list without giving up the page\'s own sources', () => {
  const from = (initiator, kind, n) => ({ initiator, url: `https://x.test/${new URL(initiator).hostname}-${n}.${kind === 'file' ? 'mp4' : 'm3u8'}`, kind, headers: [], gen: 0 });
  const page = 'https://a.test';
  const urls = result => result.list.map(s => s.url);

  // One frame flooding the list pushes out its own entries.
  const flooded = [from(page, 'hls', 1), from('https://ads.test', 'hls', 1), from('https://ads.test', 'hls', 2)];
  const next = from('https://ads.test', 'hls', 3);
  assert.deepEqual(urls(addSource(flooded, next, 3, page)), [flooded[0].url, flooded[2].url, next.url]);

  // Many frames with one entry each (as many sites as an attacker likes) do not push out the page's either.
  const crowd = [from(page, 'hls', 1), from('https://f1.test', 'hls', 1), from('https://f2.test', 'hls', 1)];
  const another = from('https://f3.test', 'hls', 1);
  assert.deepEqual(urls(addSource(crowd, another, 3, page)), [crowd[0].url, crowd[2].url, another.url]);

  // Only when the page's sources are all there is does one of them go, and only for another
  // of the page's own: the oldest file before any stream.
  const own = [from(page, 'hls', 1), from(page, 'file', 1), from(page, 'file', 2)];
  const more = from(page, 'hls', 2);
  assert.deepEqual(urls(addSource(own, more, 3, page)), [own[0].url, own[2].url, more.url]);
  // A frame's source is turned away rather than let in at the page's expense.
  assert.equal(addSource(own, from('https://ads.test', 'hls', 1), 3, page), null);
});

test('applyInspection labels a stream and folds its variants into it', () => {
  const own = 'https://a.test';
  const master = { initiator: own, url: 'https://cdn.test/hls/master.m3u8', kind: 'hls', headers: [], gen: 0 };
  const variant = { initiator: own, url: 'https://cdn.test/hls/720.m3u8', kind: 'hls', headers: [], gen: 0 };
  const other = { initiator: own, url: 'https://cdn.test/clip.mp4', kind: 'file', headers: [], gen: 0 };
  const info = { drm: false, height: 1080, variants: ['https://cdn.test/hls/720.m3u8', 'https://cdn.test/hls/1080.m3u8'] };

  const list = applyInspection([variant, master, other], master, info);
  assert.deepEqual(list.map(s => s.url), [master.url, other.url]);
  assert.equal(list[0].drm, false);
  assert.equal(list[0].height, 1080);
  // The variant requested later, with a new signature, is recognized and not listed again.
  assert.equal(addSource(list, { ...variant, url: `${variant.url}?t=2` }, 50), null);
  // What is remembered about variants is small, however long their addresses are.
  const long = { ...info, variants: Array.from({ length: 200 }, (_, i) => `https://cdn.test/hls/${i}/${'x'.repeat(3000)}.m3u8`) };
  const [stored] = applyInspection([master], master, long);
  assert.ok(JSON.stringify(stored).length < 4000, `${JSON.stringify(stored).length} bytes`);

  // The stream is gone (the tab moved on): nothing to record.
  assert.equal(applyInspection([other], master, info), null);
});

test('applyInspection does not fold what another frame loaded', () => {
  const real = { initiator: 'https://a.test', url: 'https://cdn.test/real.m3u8', kind: 'hls', headers: [], gen: 0 };
  const planted = { initiator: 'https://ads.test', url: 'https://ads.test/master.m3u8', kind: 'hls', headers: [], gen: 0 };
  // An advert's manifest names the page's real stream as its "variant" to make it disappear.
  const hidden = applyInspection([real, planted], planted, { drm: false, height: 4320, variants: [real.url] });
  assert.deepEqual(hidden.map(s => s.url), [real.url, planted.url]);
  assert.notEqual(addSource(hidden, { ...real, url: `${real.url}?t=2` }, 50), null);
});

test('applyInspection tells a stream from variants that share its path', () => {
  // Master and variants at one path, told apart by the query only.
  const master = { initiator: 'https://a.test', url: 'https://a.test/hls?type=master', kind: 'hls', headers: [], gen: 0 };
  const info = { drm: false, height: 1080, variants: ['https://a.test/hls?type=360', 'https://a.test/hls?type=1080'] };
  const list = applyInspection([master], master, info);
  assert.equal(list.length, 1);
  // The player asking for a variant does not repoint the row at it...
  assert.equal(addSource(list, { ...master, url: 'https://a.test/hls?type=360' }, 50), null);
  // ...while the master asked for again with a new signature still refreshes it.
  const refreshed = addSource(list, { ...master, url: 'https://a.test/hls?type=master&sig=2' }, 50);
  assert.equal(refreshed.list[0].url, 'https://a.test/hls?type=master&sig=2');
  assert.equal(refreshed.list[0].height, 1080);

  // The usual order: the player asks for a variant before the extension has finished reading
  // the master. The row is the master's again once it has.
  const early = addSource([master], { ...master, url: 'https://a.test/hls?type=360', headers: ['X: variant'] }, 50).list;
  assert.equal(early[0].url, 'https://a.test/hls?type=360');
  const [restored] = applyInspection(early, master, info);
  assert.equal(restored.url, master.url);
  assert.deepEqual(restored.headers, master.headers);
  assert.equal(restored.height, 1080);
});

test('hmacHex matches the standard and the app', async () => {
  // RFC 4231, test case 2.
  assert.equal(
    await hmacHex('Jefe', 'what do ya want for nothing?'),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
  );
  // The same vector is checked in src-tauri/src/bridge.rs, so both sides agree.
  assert.equal(
    await hmacHex('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'app:abc123'),
    'a75708d9c871060924d5d414e08fc2e57deaa6e1a48469824224631fa7fb055d',
  );
});
