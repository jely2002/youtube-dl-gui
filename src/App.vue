<template>
  <router-view />
  <the-toaster />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { listen } from '@tauri-apps/api/event';
import TheToaster from './components/TheToaster.vue';
import { useBinariesStore } from './stores/binaries';
import { useRouter } from 'vue-router';
import { useUpdaterStore } from './stores/updater';
import { useStrongholdStore } from './stores/stronghold';
import { useDragDrop } from './composables/useDragDrop.ts';
import { useMediaStore } from './stores/media/media'; // Import the media store

const router = useRouter();
const binariesStore = useBinariesStore();
const updaterStore = useUpdaterStore();
const strongholdStore = useStrongholdStore();
const mediaStore = useMediaStore(); // Initialize media store

useDragDrop();

const checkTools = async () => {
  const toolsToEnsure = await binariesStore.check();
  if (toolsToEnsure.length > 0) {
    await router.push('/install');
  }
};

const checkUpdates = async () => {
  try {
    await updaterStore.check();
  } catch (e) {
    console.warn('Unable to check for updates:', e);
  }
};

// --- NEW: Deep Link Listener ---
onMounted(async () => {
  await listen<string[]>('deep-link', (event) => {
    const args = event.payload;
    const url = args.find(arg => arg.startsWith('ovd://'));

    if (url) {
      // Clean and fix the URL
      let cleanUrl = url.replace('ovd://', '').replace('https//', 'https://');
      if (cleanUrl.startsWith('https') && !cleanUrl.includes('://')) {
        cleanUrl = cleanUrl.replace('https', 'https://');
      }

      // Trigger the download
      void mediaStore.dispatchMediaInfoFetch(cleanUrl);
    }
  });
});
// -------------------------------

// --- Original Startup Logic ---
try {
  void checkTools();
} catch (e) {
  console.error(e);
}

try {
  void strongholdStore.loadStatus();
} catch (e) {
  console.error(e);
}

void checkUpdates();
</script>
