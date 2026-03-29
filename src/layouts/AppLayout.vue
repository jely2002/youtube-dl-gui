<template>
  <the-header/>
  <main class="flex‑grow overflow-auto h-full relative bg-base-200">
    <router-view :key="$route.fullPath"/>
    <the-updater/>
  </main>
  <the-footer/>
</template>
<script setup lang="ts">
import TheFooter from '../components/TheFooter.vue';
import TheHeader from '../components/TheHeader.vue';
import TheUpdater from '../components/TheUpdater.vue';
import { ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMediaGroupStore } from '../stores/media/group.ts';

const route = useRoute();
const router = useRouter();
const groupStore = useMediaGroupStore();
const transitionName = ref('slide');
const isMissingGroupRedirecting = ref(false);

let prevIndex = route.meta.index || 0;

watch(
  () => route.fullPath,
  () => {
    const toIndex = route.meta.index ?? 0;
    transitionName.value = toIndex > prevIndex ? 'slide-left' : 'slide-right';
    prevIndex = toIndex;
  },
);

watchEffect(() => {
  const requiresGroup = route.matched.some(record => record.meta.requiresGroup);
  if (!requiresGroup) {
    return;
  }

  const rawGroupId = route.params.groupId;
  const groupId = Array.isArray(rawGroupId) ? rawGroupId[0] : rawGroupId;
  if (!groupId || !groupStore.findGroupById(groupId)) {
    if (isMissingGroupRedirecting.value) return;
    isMissingGroupRedirecting.value = true;
    void router.replace({ name: 'home' }).finally(() => {
      isMissingGroupRedirecting.value = false;
    });
  }
});
</script>

<style>
#app {
  @apply flex;
  @apply h-screen;
  @apply flex-col;
}
</style>
