<template>
  <base-fieldset
    :legend="t('settings.network.legend')"
    :label="t('settings.network.legendLabel')"
  >
    <network-settings-editor v-model="networkState" />
  </base-fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseFieldset from '../base/BaseFieldset.vue';
import NetworkSettingsEditor from '../network/NetworkSettingsEditor.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const networkState = computed({
  get: () => settings.value.network,
  set: (value) => {
    settings.value.network = value;
  },
});
</script>
