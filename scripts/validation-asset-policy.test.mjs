import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { verifyAssetBytes } from './validation-asset-policy.mjs';

const bytes = Buffer.from('exact signed download bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const asset = { url: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-winarm64-gpl.zip', sha256 };
test('download verification accepts only the expected signed checksum', () => {
  assert.equal(verifyAssetBytes('ffmpeg', asset, bytes), sha256);
  assert.equal(verifyAssetBytes('ffmpeg', { ...asset, sha256: sha256.toUpperCase() }, bytes), sha256);
});
test('changed latest archives remain rejected and expose expected and actual hashes', () => {
  const changed = Buffer.from('upstream replaced latest');
  const actual = createHash('sha256').update(changed).digest('hex');
  assert.throws(() => verifyAssetBytes('ffmpeg', asset, changed), (error) => {
    assert.match(error.message, /signed manifest SHA256 mismatch/);
    assert.ok(error.message.includes(`expected ${sha256}, got ${actual}`));
    return true;
  });
});
