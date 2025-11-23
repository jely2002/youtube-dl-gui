import { readFile, writeFile } from 'fs/promises';
import { createPrivateKey, sign } from 'crypto';

async function main() {
  console.log('[sign-manifest] Signing manifest');
  const manifestPath = 'docs/manifest/manifest.json';
  const privB64 = process.env.ED25519_PRIV_KEY_B64;
  if (!privB64) throw new Error('ED25519_PRIV_KEY_B64 missing');
  console.log('[sign-manifest] Loaded signing key from environment');
  const key = createPrivateKey({ key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8' });
  const manifestBytes = await readFile(manifestPath);
  console.log(`[sign-manifest] Read manifest bytes from ${manifestPath}`);
  const signature = sign(null, manifestBytes, key).toString('base64');
  const signaturePath = 'docs/manifest/manifest.sig';
  await writeFile(signaturePath, signature);
  console.log(`[sign-manifest] Wrote signature to ${signaturePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
