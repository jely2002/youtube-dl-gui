import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolSource } from './sources.ts';
import { fetchSources, TOOL_LICENSES } from './sources.ts';

const OUTPUT_DIR = 'licenses';
const NPM_FILE = join(OUTPUT_DIR, 'licenses-npm.json');
const RUST_FILE = join(OUTPUT_DIR, 'licenses-rust.txt');
const OUTPUT_FILE = join(OUTPUT_DIR, '3rdpartylicenses.txt');

type LicenseInfo = {
  name?: string;
  version?: string;
  licenses?: string | string[];
  licenseFile?: string;
};

function readFileOrEmpty(path: string): string {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    console.warn(`[licenses] missing file: ${path}`);
    return '';
  }
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR);
  }

  const rust = readFileOrEmpty(RUST_FILE);
  const npm = generateNpmLicenses();
  const externalTools = await generateExternalToolsSection();

  const content = [
    'Open Video Downloader – Third-Party Licenses',
    '===========================================',
    '',
    externalTools,
    '',
    rust ? 'RUST DEPENDENCIES\n-----------------\n\n' + rust + '\n' : '',
    npm ? '\nNPM DEPENDENCIES\n----------------\n\n' + npm + '\n' : '',
    '',
  ].join('\n');

  writeFileSync(OUTPUT_FILE, content, 'utf8');
  console.log(`[licenses] wrote ${OUTPUT_FILE}`);
}

function generateNpmLicenses() {
  const raw = readFileSync(NPM_FILE, 'utf8');
  const data: Record<string, LicenseInfo> = JSON.parse(raw);

  const packageLines: string[] = [];
  const licenseTextMap = new Map<string, string>();

  for (const [key, info] of Object.entries(data)) {
    const name = info.name || key.split('@')[0] || key;
    const version
      = info.version
        || key
          .split('@')
          .slice(1)
          .join('@')
          || 'unknown';

    const licenses = Array.isArray(info.licenses)
      ? info.licenses
      : info.licenses
        ? [info.licenses]
        : ['UNKNOWN'];

    for (const lic of licenses) {
      packageLines.push(`${name} ${version} - ${lic}`);

      if (info.licenseFile && !licenseTextMap.has(lic)) {
        try {
          const text = readFileSync(info.licenseFile, 'utf8');
          licenseTextMap.set(lic, text.trim());
        } catch (e) {
          console.warn(`[licenses] could not read license file ${info.licenseFile}: ${e}.`);
        }
      }
    }
  }

  packageLines.sort((a, b) => a.localeCompare(b));

  const licenseTextBlocks: string[] = [];
  licenseTextMap.forEach((text, id) => {
    licenseTextBlocks.push(`${id} - ${id}`);
    licenseTextBlocks.push(text);
    licenseTextBlocks.push('');
    licenseTextBlocks.push('----------------------------------------');
    licenseTextBlocks.push('');
  });

  return [
    'PACKAGES',
    '========',
    '',
    packageLines.join('\n'),
    '',
    'LICENSE TEXTS',
    '============',
    '',
    licenseTextBlocks.join('\n').trim(),
    '',
  ].join('\n');
}

async function generateExternalToolsSection() {
  let sources: ToolSource[];
  try {
    sources = await fetchSources();
  } catch (err) {
    console.warn('[licenses] Failed to fetch external tools metadata:', err);
    return '(Failed to generate external tools list)\n';
  }

  const lines: string[] = [];
  lines.push('EXTERNAL TOOLS');
  lines.push('-----------------');
  lines.push('');
  lines.push('This application may download and use external tools at runtime.');
  lines.push('These tools are separate projects with their own licenses.');
  lines.push('The versions displayed here are the ones used when this file was generated, not necessarily the current versions used by the app.');
  lines.push('');

  for (const tool of sources) {
    const meta = TOOL_LICENSES[tool.name] ?? {};
    const license = meta.license ?? '(license unknown)';
    const site = meta.url ?? '(no project URL)';

    lines.push(`${tool.name} (${tool.version})`);
    lines.push(`  License: ${license}`);
    lines.push(`  Project: ${site}`);
    lines.push('');
  }

  return lines.join('\n');
}

void main();
