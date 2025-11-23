import { readFile } from 'fs/promises';
import { createPublicKey, verify } from 'crypto';

async function main() {
  console.log('[verify-manifest] Verifying manifest signature');
  const manifestBytes = await readFile('docs/manifest/manifest.json');
  const sigB64 = await readFile('docs/manifest/manifest.sig', 'utf8');
  const pubHex = process.env.ED25519_PUB_KEY_HEX;
  if (!pubHex) throw new Error('ED25519_PUB_KEY_HEX missing');
  console.log('[verify-manifest] Loaded public key from environment');
  const pubRaw = Buffer.from(pubHex, 'hex');
  const pubB64Url = pubRaw.toString('base64url');

  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: pubB64Url,
  };

  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const sig = Buffer.from(sigB64, 'base64');
  const ok = verify(null, manifestBytes, key, sig);
  if (!ok) throw new Error('invalid signature');
  console.log('[verify-manifest] Signature is valid');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
