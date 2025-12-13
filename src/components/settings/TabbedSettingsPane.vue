<template>
  <section class="bg-base-100 p-4 rounded-box">
    <div role="tablist" class="tabs tabs-box flex gap-2 mb-4">
      <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          :id="tab.id"
          type="button"
          class="tab"
          :class="{ 'tab-active': modelValue === tab.id }"
          role="tab"
          :aria-selected="tab.id === modelValue"
          :aria-controls="`${idPrefix}-${tab.id}`"
          :tabindex="tab.id === modelValue ? 0 : -1"
          :ref="el => (tabRefs[index] = el as HTMLButtonElement)"
          @click="modelValue = tab.id"
          @keydown="onTabKey($event, tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <section
        v-for="tab in tabs"
        :key="tab.id"
        v-show="modelValue === tab.id"
        role="tabpanel"
        :id="`${idPrefix}-${tab.id}`"
        :aria-labelledby="tab.id"
        class="flex flex-col"
    >
      <slot :name="tab.id" :tab="tab" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface TabDef {
  id: string;
  label: string;
}

const props = defineProps<{
  tabs: TabDef[];
  idPrefix: string;
}>();

const modelValue = defineModel<string>({ required: true });

const tabRefs = ref<HTMLButtonElement[]>([]);

function focusTab(index: number) {
  const el = tabRefs.value[index];
  if (el) el.focus();
}

function onTabKey(e: KeyboardEvent, id: string) {
  const idx = props.tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  if (e.key === 'ArrowRight') {
    const nextIdx = (idx + 1) % props.tabs.length;
    modelValue.value = props.tabs[nextIdx].id;
    focusTab(nextIdx);
    e.preventDefault();
  }

  if (e.key === 'ArrowLeft') {
    const prevIdx = (idx - 1 + props.tabs.length) % props.tabs.length;
    modelValue.value = props.tabs[prevIdx].id;
    focusTab(prevIdx);
    e.preventDefault();
  }
}
</script>

<style scoped>
.tabs.tabs-box {
  background-color: var(--color-base-100);
  border-radius: var(--radius-box);
}

.tab {
  color: var(--color-base-content);
  border-radius: var(--radius-field);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tab:hover:not(.tab-active) {
  background-color: var(--color-neutral);
}

.tab-active {
  background-color: var(--color-neutral);
  border: var(--border) solid var(--color-primary);
}
</style>
