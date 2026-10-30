import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { verifyApplicationEvidence } from './validation-evidence.mjs';
import { preparePortable } from './prepare-portable.mjs';

const root = process.cwd();
const results = path.join(root, 'validation-results');
await mkdir(results, { recursive: true });
const input = path.join(root, 'validation-assets/input.json');
const extension = process.platform === 'win32' ? '.exe' : '';
const compiled = path.join(root, `src-tauri/target/release/open-video-downloader${extension}`);
const checks = [];
const hashes = {};
const inputMetadata = JSON.parse(await readFile(input, 'utf8'));
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const expected = { platform: inputMetadata.platform, version, commit: process.env.GITHUB_SHA };
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout: 300000, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
async function smoke(executable, mode, label) {
  const report = path.join(results, `${label}.json`);
  await rm(report, { force: true });
  const check = { label, mode, executable, report, status: 'running', guiExercised: false };
  checks.push(check);
  try {
    run(executable, ['--validate-dependencies', input, path.join(root, `validation-work/${label} ü`), report, mode]);
    const evidence = JSON.parse(await readFile(report, 'utf8'));
    check.status = verifyApplicationEvidence(evidence, expected);
    check.sourceCommit = evidence.sourceCommit;
  } catch (error) {
    check.status = 'failed';
    check.error = String(error);
    throw error;
  }
}
async function find(directory, predicate) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isFile() && predicate(file)) return file;
    if (entry.isDirectory()) {
      const nested = await find(file, predicate);
      if (nested) return nested;
    }
  }
  return null;
}
try {
  const portableExe = await preparePortable(root);
  await smoke(compiled, 'installed', 'compiled-app');
  await smoke(portableExe, 'portable', 'portable-layout');
  const bundle = path.join(root, 'src-tauri/target/release/bundle');
  let packaged;
  let method;
  if (process.platform === 'win32') {
    const setup = await find(bundle, file => file.endsWith('-setup.exe'));
    if (!setup) throw new Error('NSIS installer missing');
    const installed = path.join(process.env.RUNNER_TEMP, 'ovd-installed');
    run(setup, ['/S', `/D=${installed}`]);
    packaged = await find(installed, file => path.basename(file).toLowerCase() === 'open-video-downloader.exe');
    method = 'NSIS silent installation';
  } else if (process.platform === 'darwin') {
    packaged = await find(bundle, file => file.endsWith('.app/Contents/MacOS/open-video-downloader'));
    method = 'built .app executable';
  } else {
    const deb = await find(bundle, file => file.endsWith('.deb'));
    if (!deb) throw new Error('Debian package missing');
    const architecture = spawnSync('dpkg-deb', ['--field', deb, 'Architecture'], { encoding: 'utf8' });
    const expected = process.arch === 'arm64' ? 'arm64' : 'amd64';
    if (architecture.status !== 0 || architecture.stdout.trim() !== expected) throw new Error('Debian package architecture mismatch');
    const extracted = path.join(root, 'validation-work/deb-extracted');
    run('dpkg-deb', ['--extract', deb, extracted]);
    packaged = await find(extracted, file => path.basename(file) === 'open-video-downloader');
    method = 'Debian package extraction (not OS package registration)';
  }
  if (!packaged) throw new Error('Packaged application executable missing');
  const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
  hashes.compiled = await digest(compiled);
  hashes.packaged = await digest(packaged);
  hashes.byteIdentical = hashes.compiled === hashes.packaged;
  await smoke(packaged, 'installed', 'packaged-app');
  checks.at(-1).packagingMethod = method;
} finally {
  await writeFile(path.join(results, 'packaging.json'), JSON.stringify({ status: checks.some(check => check.status === 'failed') ? 'failed' : checks.length < 3 ? 'incomplete' : checks.some(check => check.status === 'partial') ? 'partial' : 'passed', checks, hashes, coverage: checks.some(check => check.status === 'partial') ? 'partial' : 'required checks', guiExercised: false }, null, 2));
}
