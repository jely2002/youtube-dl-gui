import { openPath as openerOpenPath, openUrl as openerOpenUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { resolveResource } from '@tauri-apps/api/path';

export function useOpener() {
  const openInternalPath = async (path: string, executable?: string) => {
    const internalPath = await resolveResource(path);
    console.log(internalPath);
    await openPath(internalPath, executable);
  };

  const openPath = async (path: string, executable?: string) => {
    if (executable) {
      await openerOpenPath(path, executable);
    } else {
      await openerOpenPath(path);
    }
  };

  const openUrl = async (path: string, executable?: string) => {
    if (executable) {
      await openerOpenUrl(path, executable);
    } else {
      await openerOpenUrl(path);
    }
  };

  const revealPath = async (path: string) => {
    await revealItemInDir(path);
  };

  return {
    openInternalPath,
    openPath,
    openUrl,
    revealPath,
  };
}
