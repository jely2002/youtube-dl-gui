import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function preparePortable(root) {
  const extension = process.platform === 'win32' ? '.exe' : '';
  const compiled = path.join(root, `src-tauri/target/release/open-video-downloader${extension}`);
  const portable = path.join(root, 'portable-layout');
  await mkdir(path.join(portable, 'ovd-portable'), { recursive: true });
  await mkdir(path.join(portable, 'licenses'), { recursive: true });
  await writeFile(path.join(portable, 'ovd-portable/.keep'), 'Keep this directory for portable storage.\n');
  const executable = path.join(portable, `open-video-downloader${extension}`);
  await cp(compiled, executable);
  await cp(path.join(root, 'licenses/3rdpartylicenses.txt'), path.join(portable, 'licenses/3rdpartylicenses.txt'));
  return executable;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await preparePortable(process.cwd());
