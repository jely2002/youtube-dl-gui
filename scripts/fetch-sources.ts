import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { createHash } from 'node:crypto';
import * as unzipper from 'unzipper';
import { main as generateManifest } from './gen-manifest.ts';

export interface FileEntry {
  url: string;
  sha256: string;
  entry?: string;
  bundle?: {
    keep_folder: boolean;
    folder_name?: string;
    entry: string;
    rename_entry_to?: string;
  };
}

export interface ToolEntry {
  version: string;
  files: Record<string, FileEntry>;
}

export interface Manifest {
  generatedAt: string;
  tools: Record<string, ToolEntry>;
}

const LAYOUT_ROOT = 'msix-layout';
const APP_DIR = path.join(LAYOUT_ROOT, 'Open Video Downloader');
const BIN_ROOT = path.join(APP_DIR, 'bin');

function detectPlatformKey(): string {
  const arch = process.arch;
  const platform = process.platform;

  if (platform === 'win32' && arch === 'x64') return 'windows-x86_64';
  if (platform === 'win32' && (arch === 'arm64' || arch === 'arm')) {
    return 'windows-aarch64';
  }
  if (platform === 'linux' && arch === 'x64') return 'linux-x86_64';
  if (platform === 'linux' && (arch === 'arm64' || arch === 'arm')) {
    return 'linux-aarch64';
  }
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x86_64';
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'arm')) {
    return 'darwin-aarch64';
  }

  throw new Error(`Unsupported platform/arch: ${platform} ${arch}`);
}

async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

function downloadWithSha256(
  url: string,
  expectedSha256: string,
  destPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpPath = `${destPath}.download`;
    const fileStream = fs.createWriteStream(tmpPath);
    const hash = createHash('sha256');

    https
      .get(url, (res) => {
        if (
          res.statusCode
          && res.statusCode >= 300
          && res.statusCode < 400
          && res.headers.location
        ) {
          res.destroy();
          return downloadWithSha256(res.headers.location, expectedSha256, destPath)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(
            new Error(`Failed to download ${url}: HTTP ${res.statusCode}`),
          );
        }

        res.on('data', chunk => hash.update(chunk));
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(async (err) => {
            if (err) return reject(err);
            try {
              const digest = hash.digest('hex');
              if (digest.toLowerCase() !== expectedSha256.toLowerCase()) {
                await fsp.rm(tmpPath, { force: true });
                return reject(
                  new Error(
                    `SHA256 mismatch for ${url}. Expected ${expectedSha256}, got ${digest}`,
                  ),
                );
              }
              await fsp.rename(tmpPath, destPath);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
      })
      .on('error', (err) => {
        fileStream.close();
        reject(err);
      });
  });
}

async function extractZipEntire(zipPath: string, destDir: string) {
  await ensureDir(destDir);
  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: destDir }))
    .promise();
}

async function extractZipSingleEntry(
  zipPath: string,
  entryPath: string,
  destPath: string,
) {
  await ensureDir(path.dirname(destPath));

  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find(f => f.path === entryPath);

  if (!entry) {
    throw new Error(`Entry "${entryPath}" not found in ${zipPath}`);
  }

  await new Promise<void>((resolve, reject) => {
    const writeStream = fs.createWriteStream(destPath);
    entry
      .stream()
      .pipe(writeStream)
      .on('finish', () => resolve())
      .on('error', reject);
  });
}

async function makeExecutableIfNeeded(filePath: string) {
  if (process.platform === 'win32') return;
  try {
    const stat = await fsp.stat(filePath);
    const mode = stat.mode | 0o755;
    await fsp.chmod(filePath, mode);
  } catch {
    // ignore chmod errors
  }
}

async function processTool(
  toolName: string,
  tool: ToolEntry,
  platformKey: string,
) {
  const file = tool.files[platformKey];
  if (!file) {
    console.log(`[fetch-sources] Skipping ${toolName}: no file for ${platformKey}`);
    return;
  }

  await ensureDir(BIN_ROOT);

  const url = file.url;
  const expectedSha = file.sha256;
  const urlPath = new URL(url).pathname;
  const baseName = path.basename(urlPath);
  const downloadPath = path.join(BIN_ROOT, baseName);

  console.log(`[fetch-sources] Downloading ${toolName} (${platformKey}) from ${url}`);
  await downloadWithSha256(url, expectedSha, downloadPath);

  const isZip = baseName.toLowerCase().endsWith('.zip');

  if (isZip) {
    if (file.bundle) {
      const bundle = file.bundle;
      const tempDir = path.join(
        BIN_ROOT,
        `.tmp-${toolName}-${platformKey}-${Date.now()}`,
      );

      const destName = bundle.rename_entry_to
        ? bundle.rename_entry_to
        : path.basename(bundle.entry);
      const destPath = path.join(BIN_ROOT, destName);
      let entrySource: string;
      if (bundle.keep_folder) {
        entrySource = path.join(BIN_ROOT, bundle.entry);
        console.log(`[fetch-sources] Extracting bundle to bin dir ${BIN_ROOT}`);
        await extractZipEntire(downloadPath, BIN_ROOT);
      } else {
        entrySource = path.join(tempDir, bundle.entry);
        console.log(`[fetch-sources] Extracting bundle to temp dir ${tempDir}`);
        await extractZipEntire(downloadPath, tempDir);
      }

      console.log(`[fetch-sources] Moving ${bundle.entry} -> ${destPath}`);
      await fsp.rename(entrySource, destPath);
      await makeExecutableIfNeeded(destPath);

      await fsp.rm(tempDir, { recursive: true, force: true });
      await fsp.rm(downloadPath, { force: true });
    } else if (file.entry) {
      const destName = path.basename(file.entry);
      const destPath = path.join(BIN_ROOT, destName);
      console.log(`[fetch-sources] Extracting entry ${file.entry} -> ${destPath}`);
      await extractZipSingleEntry(downloadPath, file.entry, destPath);
      await makeExecutableIfNeeded(destPath);
      await fsp.rm(downloadPath, { force: true });
    } else {
      console.log(`[fetch-sources] Extracting entire archive into bin/`);
      await extractZipEntire(downloadPath, BIN_ROOT);
      await fsp.rm(downloadPath, { force: true });
    }
  } else {
    console.log(`[fetch-sources] Saved plain binary as ${downloadPath}`);
    const extension = platformKey.startsWith('windows-') ? '.exe' : '';
    const destPath = path.join(BIN_ROOT, toolName + extension);
    console.log(`[fetch-sources] Moving ${downloadPath} -> ${destPath}`);
    await fsp.rename(downloadPath, destPath);
    await makeExecutableIfNeeded(destPath);
  }
}

async function writeMetadata(manifest: Manifest) {
  const versions: Record<string, string> = {};

  for (const [name, tool] of Object.entries(manifest.tools)) {
    versions[name] = tool.version;
  }

  const metadata = {
    is_locked: true,
    versions,
  };

  await ensureDir(BIN_ROOT);
  const metadataPath = path.join(BIN_ROOT, 'metadata.json');
  await fsp.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`\n[fetch-sources] Wrote ${metadataPath}`);
}

async function main() {
  const platformKey = detectPlatformKey();
  console.log(`[fetch-sources] Detected platform key: ${platformKey}`);
  console.log(`[fetch-sources] App dir: ${APP_DIR}`);
  console.log(`[fetch-sources] Bin root: ${BIN_ROOT}\n`);

  const manifest = await generateManifest();

  for (const [toolName, tool] of Object.entries(manifest.tools)) {
    await processTool(toolName, tool, platformKey);
  }

  await writeMetadata(manifest);
  console.log('[fetch-sources] All done.');
}

main().catch((err) => {
  console.error('[fetch-sources] ERROR:', err);
  process.exit(1);
});
