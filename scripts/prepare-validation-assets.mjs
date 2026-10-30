import { createPublicKey, verify } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyAssetBytes } from './validation-asset-policy.mjs';

const output = path.resolve(process.argv[2] ?? 'validation-assets');
const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
if (!os || !arch) throw new Error(`Unsupported native runner: ${process.platform}/${process.arch}`);
const platform = `${os}-${arch}`;
if (process.env.OVD_EXPECT_PLATFORM && platform !== process.env.OVD_EXPECT_PLATFORM) {
  throw new Error(`Expected native ${process.env.OVD_EXPECT_PLATFORM}, Node is ${platform}`);
}
async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
await mkdir(output, { recursive: true });
for (const filename of ['input.json', 'downloads.json', 'manifest.json', 'manifest.sig']) {
  await rm(path.join(output, filename), { force: true });
}
const base = 'https://jely2002.github.io/youtube-dl-gui/manifest';
const bytes = await get(`${base}/manifest.json`);
const signature = Buffer.from((await get(`${base}/manifest.sig`)).toString().trim(), 'base64');
const key = createPublicKey({
  key: Buffer.from('302a300506032b6570032100ae7988a00d92349e55ff560369e7ec6afdb4b22a7e1dbe62a6769e1f347fa073', 'hex'),
  format: 'der', type: 'spki',
});
if (!verify(null, bytes, key, signature)) throw new Error('Manifest signature verification failed');
const manifest = JSON.parse(bytes);
await writeFile(path.join(output, 'manifest.json'), bytes);
await writeFile(path.join(output, 'manifest.sig'), signature.toString('base64'));
const evidence = [];
async function saveEvidence(status, error) {
  await writeFile(path.join(output, 'downloads.json'), JSON.stringify({
    platform, status, signatureVerified: true,
    evidence, ...(error ? { error: String(error) } : {}),
  }, null, 2));
}
for (const [tool, info] of Object.entries(manifest.tools)) {
  const selected = info.files[platform]
    ? platform
    : tool === 'AtomicParsley' && platform === 'darwin-aarch64' && info.files['darwin-x86_64'] ? 'darwin-x86_64' : null;
  if (!selected) {
    evidence.push({ tool, status: 'no managed asset', platform });
    continue;
  }
  try {
    const asset = info.files[selected];
    const file = await get(asset.url);
    const digest = verifyAssetBytes(tool, asset, file);
    const filename = path.basename(new URL(asset.url).pathname);
    const directory = path.join(output, tool);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), file);
    evidence.push({ tool, selected, url: asset.url, sha256: digest, bytes: file.length });
    console.log(`${tool}: verified ${selected} asset (${file.length} bytes)`);
    await saveEvidence('preparing');
  } catch (error) {
    evidence.push({ tool, selected, status: 'failed', error: String(error) });
    await saveEvidence('failed', error);
    throw error;
  }
}
await writeFile(path.join(output, 'input.json'), JSON.stringify({ platform, assetsRoot: output, tools: manifest.tools }, null, 2));
await saveEvidence('passed');
console.log(`Native assets prepared for ${platform}`);
