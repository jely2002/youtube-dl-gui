import { writeFile, mkdir, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { canonicalize } from './canonicalize.ts';
import { fetchSources } from './sources.ts';

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

async function sha256(url: string): Promise<string> {
  const headers: Record<string, string> = {};
  const githubToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`failed to fetch ${url}: ${res.status}`);
  }
  const hash = createHash('sha256');
  for await (const chunk of res.body as any) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

export async function main(): Promise<Manifest> {
  console.log('[gen-manifest] Starting manifest generation');
  const sources = await fetchSources();
  const tools: Record<string, ToolEntry> = {};
  for (const src of sources) {
    console.log(`[gen-manifest] Processing ${src.name}@${src.version}`);
    const files: Record<string, FileEntry> = {};
    for (const [platform, info] of Object.entries(src.files)) {
      const digest = info.sha256 || await sha256(info.url);
      const digestSource = info.sha256 ? 'source metadata' : 'downloaded file';
      console.log(
        `[gen-manifest]  - ${platform}: ${canonicalize(info.url)} (sha256 from ${digestSource})`,
      );
      files[platform] = { url: canonicalize(info.url), sha256: digest, entry: info.entry, bundle: info.bundle };
    }
    tools[src.name] = { version: src.version, files };
  }
  const manifest: Manifest = { generatedAt: new Date().toISOString(), tools };
  await mkdir('docs/manifest', { recursive: true });
  const manifestPath = 'docs/manifest/manifest.json';
  const newManifest = JSON.stringify(manifest, null, 2);

  let previousManifest: string | undefined;
  let previousManifestData: Manifest | undefined;
  try {
    previousManifest = await readFile(manifestPath, 'utf8');
    previousManifestData = JSON.parse(previousManifest) as Manifest;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }

  if (previousManifest && previousManifest === newManifest) {
    console.log('[gen-manifest] Existing manifest is up-to-date; no changes written');
  } else {
    await writeFile(manifestPath, newManifest);
    if (previousManifest) {
      console.log('[gen-manifest] Manifest updated with new content');
      if (previousManifestData) {
        const changes: string[] = [];
        const prevTools = previousManifestData.tools;
        const newTools = manifest.tools;

        for (const [name, newTool] of Object.entries(newTools)) {
          const prevTool = prevTools[name];
          if (!prevTool) {
            changes.push(`Added tool ${name}@${newTool.version}`);
            continue;
          }
          if (prevTool.version !== newTool.version) {
            changes.push(`Updated ${name} version ${prevTool.version} -> ${newTool.version}`);
          }
          for (const [platform, newFile] of Object.entries(newTool.files)) {
            const prevFile = prevTool.files[platform];
            if (!prevFile) {
              changes.push(`Added ${name} ${platform} artifact ${newFile.url}`);
              continue;
            }
            if (prevFile.url !== newFile.url) {
              changes.push(
                `Updated ${name} ${platform} artifact URL ${prevFile.url} -> ${newFile.url}`,
              );
            }
            if (prevFile.sha256 !== newFile.sha256) {
              changes.push(
                `Updated ${name} ${platform} sha256 ${prevFile.sha256} -> ${newFile.sha256}`,
              );
            }
            if ((prevFile.entry || undefined) !== (newFile.entry || undefined)) {
              changes.push(
                `Updated ${name} ${platform} entry ${(prevFile.entry || 'none')} -> ${(newFile.entry || 'none')}`,
              );
            }
          }
          for (const platform of Object.keys(prevTool.files)) {
            if (!newTool.files[platform]) {
              changes.push(`Removed ${name} ${platform} artifact`);
            }
          }
        }

        for (const name of Object.keys(prevTools)) {
          if (!newTools[name]) {
            changes.push(`Removed tool ${name}@${prevTools[name].version}`);
          }
        }

        if (changes.length === 0) {
          console.log('[gen-manifest] Manifest content changed but no differences detected');
        } else {
          console.log('[gen-manifest] Changes:');
          for (const change of changes) {
            console.log(`[gen-manifest]   ${change}`);
          }
        }
      }
    } else {
      console.log(`[gen-manifest] Manifest created at ${manifestPath}`);
      console.log('[gen-manifest] Initial tool versions:');
      for (const [name, tool] of Object.entries(manifest.tools)) {
        console.log(`[gen-manifest]   ${name}@${tool.version}`);
      }
    }
  }

  console.log('[gen-manifest] Finished manifest generation');

  return manifest;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
