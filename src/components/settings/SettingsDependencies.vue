<template>
  <base-fieldset class="dependencies" :legend="t('settings.dependencies.legend')" :label="t('settings.dependencies.hint')">
    <p class="label">{{ t('settings.dependencies.saveHint') }}</p>
    <button type="button" class="btn btn-sm btn-soft self-start justify-self-start" :disabled="loading" @click="refresh">
      {{ t('settings.dependencies.refresh') }}
    </button>
    <p v-if="error" role="alert" class="text-error break-words">{{ error }}</p>
    <div v-for="tool in dependencyNames" :key="tool" class="flex flex-col gap-1 mt-3 min-w-0">
      <label class="font-semibold" :for="`dependency-${tool}`">{{ tool }}</label>
      <template v-if="reportFor(tool)">
        <p class="text-sm">{{ t(`settings.dependencies.status.${reportFor(tool)!.status}`) }}</p>
        <template v-if="reportFor(tool)!.active">
          <p class="text-sm">
            {{ t('settings.dependencies.versionSource', { version: reportFor(tool)!.active!.version, source: t(`settings.dependencies.source.${reportFor(tool)!.active!.source}`) }) }}
          </p>
          <p class="text-xs break-all">{{ reportFor(tool)!.active!.path }}</p>
        </template>
        <p v-for="diagnostic in reportFor(tool)!.diagnostics" :key="diagnostic.path" class="text-xs break-words">
          {{ t('settings.dependencies.diagnostic', { path: diagnostic.path, reason: diagnostic.reason }) }}
        </p>
      </template>
      <div class="dependency-controls flex flex-wrap gap-2">
        <input :id="`dependency-${tool}`" v-model="settings.dependencies.paths[tool]" type="text" class="input input-sm" :placeholder="t('settings.dependencies.automatic')" :disabled="locked" />
        <button type="button" class="btn btn-sm btn-soft" :disabled="locked" @click="select(tool)">{{ t('settings.dependencies.browse') }}</button>
        <button type="button" class="btn btn-sm btn-soft" :disabled="locked || !settings.dependencies.paths[tool]" @click="settings.dependencies.paths[tool] = ''">{{ t('settings.dependencies.automatic') }}</button>
      </div>
    </div>
    <p v-if="locked" class="label">{{ t('settings.dependencies.locked') }}</p>
  </base-fieldset>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useI18n } from 'vue-i18n';
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config';
import { DependencyReport, dependencyNames } from '../../tauri/types/binaries';

const settings = defineModel<Settings>({ required: true });
const { t } = useI18n();
const reports = ref<DependencyReport[]>([]);
const loading = ref(false);
const error = ref('');
const locked = computed(() => reports.value.some(report => report.locked || report.active?.source === 'bundled'));
const reportFor = (tool: string) => reports.value.find(report => report.tool === tool);

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    reports.value = await invoke<DependencyReport[]>('binaries_status');
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

async function select(tool: string) {
  try {
    const selected = await open({ multiple: false, directory: false });
    if (selected) settings.value.dependencies.paths[tool] = selected;
  } catch (e) {
    error.value = String(e);
  }
}

onMounted(refresh);
</script>

<style scoped>
.dependencies {
  min-inline-size: 0;
  max-width: 100%;
  grid-template-columns: minmax(0, 1fr);
}

.dependencies p,
.dependencies :deep(.label) {
  white-space: normal;
  overflow-wrap: anywhere;
}

.dependency-controls input {
  flex: 1 1 16rem;
  min-width: 0;
  max-width: 100%;
}

.dependencies button {
  height: auto;
  min-height: 2rem;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.dependency-controls button {
  flex: 0 1 auto;
}
</style>
