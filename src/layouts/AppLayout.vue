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
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const transitionName = ref('slide');

let prevIndex = route.meta.index || 0;

watch(
  () => route.fullPath,
  () => {
    const toIndex = route.meta.index ?? 0;
    transitionName.value = toIndex > prevIndex ? 'slide-left' : 'slide-right';
    prevIndex = toIndex;
  },
);
</script>

<style>
#app {
  @apply flex;
  @apply h-screen;
  @apply flex-col;
}
</style>
