<template>
  <div class="flex flex-col">
    <SettingsSystem v-model="settings" />
    <div class="divider my-0" />
    <SettingsUpdate v-model="settings" />
    <div class="divider my-0" />
    <SettingsDependencies v-model="settings" />
  </div>
</template>

<script setup lang="ts">
import { Settings } from '../../../tauri/types/config.ts';
import SettingsDependencies from '../../../components/settings/SettingsDependencies.vue';
import SettingsSystem from '../../../components/settings/SettingsSystem.vue';
import SettingsUpdate from '../../../components/settings/SettingsUpdate.vue';

const settings = defineModel<Settings>({ required: true });
</script>
