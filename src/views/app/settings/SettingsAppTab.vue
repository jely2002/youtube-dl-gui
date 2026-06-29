<template>
  <div class="flex flex-col">
    <SettingsInput v-model="settings" />
    <div class="divider my-0" />
    <SettingsAppearance v-model="settings" />
    <div class="divider my-0" />
    <SettingsNotifications v-model="settings" />
  </div>
</template>

<script setup lang="ts">
import { Settings } from '../../../tauri/types/config.ts';
import SettingsAppearance from '../../../components/settings/SettingsAppearance.vue';
import SettingsInput from '../../../components/settings/SettingsInput.vue';
import SettingsNotifications from '../../../components/settings/SettingsNotifications.vue';

const settings = defineModel<Settings>({ required: true });
</script>
