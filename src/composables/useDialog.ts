import { DialogFilter, open } from '@tauri-apps/plugin-dialog';

export function useDialog() {
  const openPathDialog = async (multiple: boolean, directory: boolean, filters?: DialogFilter[]) => {
    return await open({
      multiple,
      directory,
      filters,
    });
  };

  return {
    openPathDialog,
  };
}
