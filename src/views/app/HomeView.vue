<template>
  <div class="relative h-full">
    <empty-state v-if="groupStore.countGroups() === 0 && !isDragging" />
    <drag-state v-else-if="groupStore.countGroups() === 0 && isDragging" />

    <div
        v-else
        class="flex gap-4 px-6 py-4 max-[1432px]:justify-center content-start flex-wrap"
    >
      <media-card
          v-for="group in groupStore.orderedGroups"
          :key="group.id"
          :group="group"
      />
    </div>
    <drag-drop-overlay v-if="isDragging" />
  </div>
</template>

<script setup lang="ts">
import MediaCard from '../../components/media-card/MediaCard.vue';
import { useMediaGroupStore } from '../../stores/media/group';
import EmptyState from '../../components/home-view/EmptyState.vue';
import { useDragDropStore } from '../../stores/dragDrop.ts';
import { computed } from 'vue';
import DragDropOverlay from '../../components/home-view/DragDropOverlay.vue';
import DragState from '../../components/home-view/DragState.vue';

const groupStore = useMediaGroupStore();

const dragDropStore = useDragDropStore();
const isDragging = computed(() => dragDropStore.isOver);
</script>
