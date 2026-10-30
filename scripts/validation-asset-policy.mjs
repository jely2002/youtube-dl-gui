import { createHash } from 'node:crypto';

export function verifyAssetBytes(tool, asset, bytes) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== asset.sha256.toLowerCase()) {
    throw new Error(`${tool}: signed manifest SHA256 mismatch at ${asset.url}; expected ${asset.sha256}, got ${actual}`);
  }
  return actual;
}
