<template>
  <SettingsNetwork v-model="settings" />
</template>

<script setup lang="ts">
import { Settings } from '../../../tauri/types/config.ts';
import SettingsNetwork from '../../../components/settings/SettingsNetwork.vue';

const settings = defineModel<Settings>({ required: true });
</script>
