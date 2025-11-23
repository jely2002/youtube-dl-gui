import { Ref, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface LogAppendEvent {
  groupId: string;
  line: string;
}

export function useGroupLog(groupId: Ref<string>) {
  const logText = ref('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  let unlisten: UnlistenFn | null = null;

  async function subscribe(groupId: string) {
    isLoading.value = true;
    error.value = null;

    try {
      logText.value = await invoke<string>('logging_subscribe', { groupId });

      unlisten = await listen<LogAppendEvent>('logging_append', (event) => {
        if (event.payload.groupId === groupId) {
          logText.value += event.payload.line;
        }
      });
    } catch (e: any) {
      console.error('Failed to subscribe to logs', e);
      error.value = e?.message ?? String(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function unsubscribe(groupId: string) {
    try {
      await invoke('logging_unsubscribe', { groupId });
    } catch {
      // best-effort, ignore
    }
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
  }

  onMounted(() => {
    const id = groupId.value;
    if (id) {
      void subscribe(id);
    }
  });

  onBeforeUnmount(() => {
    const id = groupId.value;
    if (id) {
      void unsubscribe(id);
    } else if (unlisten) {
      unlisten();
    }
  });

  watch(
    groupId,
    async (newId, oldId) => {
      if (newId === oldId) return;

      if (oldId) {
        await unsubscribe(oldId);
        logText.value = '';
      }
      if (newId) {
        await subscribe(newId);
      }
    },
  );

  return {
    logText,
    isLoading,
    error,
  };
}
