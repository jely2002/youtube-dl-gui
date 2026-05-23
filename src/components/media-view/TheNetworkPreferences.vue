<template>
  <form class="py-4 px-8">
    <div class="flex flex-col max-w-4xl">
      <base-fieldset
        :legend="t('settings.network.legend')"
        :badge="t('media.preferences.badges.override')"
        :label="t('media.preferences.labels.network')"
      >
        <network-settings-editor v-model="networkState" id-prefix="override" />
      </base-fieldset>
      <div class="divider mt-0 mb-2" />
      <base-fieldset
        :legend="t('auth.credentials.customHeaders.legend')"
        :badge="t('auth.credentials.customHeaders.legendBadge')"
        :label="t('media.preferences.labels.headersOverride')"
      >
        <label for="override-headers" class="label">
          <span class="font-semibold">{{ t('auth.credentials.labels.headers') }}</span>
        </label>
        <textarea
          id="override-headers"
          class="textarea rounded-xl w-full"
          rows="5"
          v-model="headersText"
          :placeholder="t('auth.credentials.customHeaders.placeholder')"
        />
      </base-fieldset>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseFieldset from '../base/BaseFieldset.vue';
import NetworkSettingsEditor from '../network/NetworkSettingsEditor.vue';
import { useMediaOptionsStore } from '../../stores/media/options.ts';
import { DownloadOverrides } from '../../tauri/types/media.ts';
import { defaultNetworkSettings, type NetworkSettings } from '../../tauri/types/config.ts';
import { useSettingsStore } from '../../stores/settings.ts';

const props = defineProps({
  groupId: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
const optionsStore = useMediaOptionsStore();
const settingsStore = useSettingsStore();

const networkState = ref<NetworkSettings>({
  ...defaultNetworkSettings,
});
const headersText = ref('');

const parseHeaders = (value: string): string[] =>
  value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

const syncFromStore = () => {
  const current = optionsStore.getOverrides(props.groupId);
  networkState.value = {
    enableProxy: current?.network?.enableProxy ?? false,
    proxy: current?.network?.proxy ?? '',
    impersonate: current?.network?.impersonate ?? 'none',
    extractorArgs: current?.network?.extractorArgs ?? '',
  };
  headersText.value = (current?.auth?.headers ?? []).join('\n');
};

watch(() => props.groupId, syncFromStore, { immediate: true });

watch([networkState, headersText], () => {
  const trimmedProxy = networkState.value.proxy?.trim() ?? '';
  const headers = parseHeaders(headersText.value);
  const globalNetwork = settingsStore.settings.network;
  const extractorArgs = networkState.value.extractorArgs.trim();
  const globalExtractorArgs = settingsStore.settings.network.extractorArgs.trim();

  const networkPayload = {
    enableProxy: networkState.value.enableProxy ?? false,
    proxy: trimmedProxy || undefined,
    impersonate: networkState.value.impersonate !== 'none'
      ? networkState.value.impersonate
      : undefined,
    extractorArgs: extractorArgs || undefined,
  };
  const hasNetwork
    = (globalNetwork.enableProxy ?? false) !== (networkState.value.enableProxy ?? false)
      || (globalNetwork.proxy ?? '') !== trimmedProxy
      || (globalNetwork.impersonate ?? 'none') !== networkState.value.impersonate
      || globalExtractorArgs !== extractorArgs;
  const hasAuth = headers.length > 0;

  const existing = optionsStore.getOverrides(props.groupId);
  const next: DownloadOverrides = {
    ...(existing ?? {}),
  };
  if (hasNetwork) next.network = networkPayload;
  else delete next.network;

  if (hasAuth) next.auth = { ...(existing?.auth ?? {}), headers };
  else if (existing?.auth) {
    const nextAuth = { ...existing.auth };
    delete nextAuth.headers;
    next.auth = Object.keys(nextAuth).length ? nextAuth : undefined;
  } else {
    delete next.auth;
  }

  const hasAny = Object.values(next).some(v => v !== undefined);
  if (hasAny) {
    optionsStore.setOverrides(props.groupId, next);
  } else {
    optionsStore.removeOverrides(props.groupId);
  }
}, { deep: true });
</script>
