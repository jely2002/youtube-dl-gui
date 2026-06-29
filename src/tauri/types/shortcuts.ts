export type ShortcutAction = 'media_add' | 'media_add_and_download' | 'download_all';

export interface ShortcutActionPayload {
  action: ShortcutAction;
}
