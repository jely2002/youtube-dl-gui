import assert from 'node:assert/strict';
import test from 'node:test';
import { windowsArmBuild } from './ffmpeg-builds.ts';

const name = 'ffmpeg-N-128201-g5385979def-winarm64-gpl.zip';
const release = tag => ({
  tag_name: tag, published_at: '2026-10-29T23:04:00Z',
  assets: [{ name, browser_download_url: `https://github.com/yt-dlp/FFmpeg-Builds/releases/download/${tag}/${name}` }],
});
test('FFmpeg source selection skips mutable latest and derives dated archive entries', () => {
  const stable = release('autobuild-2026-10-29-23-03');
  assert.deepEqual(windowsArmBuild([release('latest'), stable]), {
    url: stable.assets[0].browser_download_url, directory: name.slice(0, -4),
  });
  assert.throws(() => windowsArmBuild([release('latest')]), /No dated/);
});
test('dated selection rejects missing ARM assets, drafts and mutable or unrelated URLs', () => {
  for (const bad of [
    { ...release('autobuild-2026-10-29-23-03'), assets: [] },
    { ...release('autobuild-2026-10-29-23-03'), draft: true },
    { ...release('autobuild-2026-10-29-23-03'), assets: release('latest').assets },
    { ...release('autobuild-2026-10-29-23-03'), assets: [{ name, browser_download_url: 'https://example.invalid/file.zip' }] },
  ]) assert.throws(() => windowsArmBuild([bad]), /No dated/);
});
