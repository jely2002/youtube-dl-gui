import { invoke } from '@tauri-apps/api/core';
import { NotificationKind } from './types/app';
import { Group } from './types/group';

export async function notifyGroup(
  kind: NotificationKind,
  group: Group,
  extraParams: Record<string, string> = {},
  count?: number,
): Promise<void> {
  const params: Record<string, string> = {
    title: group.title ?? group.url,
    ...extraParams,
  };
  if (count != null) {
    params.n = count.toString();
  }
  await notify(kind, params, group.fromShortcut);
}

export async function notify(kind: NotificationKind, params: Record<string, string>, force: boolean = false): Promise<void> {
  try {
    await invoke<void>('notify', { kind, params, force });
  } catch (e) {
    console.warn('Failed to notify user:', e);
  }
}
