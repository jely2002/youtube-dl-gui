import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { preparePortable } from './prepare-portable.mjs';

test('portable files can be prepared without dependency download or diagnostic reports', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ovd-portable-'));
  try {
    const extension = process.platform === 'win32' ? '.exe' : '';
    await mkdir(path.join(root, 'src-tauri/target/release'), { recursive: true });
    await mkdir(path.join(root, 'licenses'));
    await writeFile(path.join(root, `src-tauri/target/release/open-video-downloader${extension}`), 'compiled application');
    await writeFile(path.join(root, 'licenses/3rdpartylicenses.txt'), 'licenses');
    const executable = await preparePortable(root);
    assert.equal(await readFile(executable, 'utf8'), 'compiled application');
    assert.equal(await readFile(path.join(root, 'portable-layout/licenses/3rdpartylicenses.txt'), 'utf8'), 'licenses');
    assert.match(await readFile(path.join(root, 'portable-layout/ovd-portable/.keep'), 'utf8'), /portable storage/);
    assert.ok((await readdir(path.join(root, 'portable-layout'))).every(name => !name.endsWith('.zip')));
    assert.equal(await preparePortable(root), executable);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
