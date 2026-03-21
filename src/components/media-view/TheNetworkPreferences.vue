<template>
  <form class="py-4 px-8">
    <div class="flex flex-col gap-4 max-w-4xl">
      <base-fieldset
        :legend="t('settings.network.legend')"
        :badge="t('media.preferences.badges.override')"
        :label="t('media.preferences.labels.network')"
      >
        <label class="font-semibold mt-2" for="override-enable-proxy">
          {{ t('settings.network.enableProxy.label') }}
        </label>
        <input
          id="override-enable-proxy"
          type="checkbox"
          v-model="enableProxy"
          class="toggle toggle-primary"
        />

        <label class="font-semibold mt-2" for="override-proxy">
          {{ t('settings.network.proxy.label') }}
        </label>
        <input
          id="override-proxy"
          type="text"
          class="input mb-2"
          :disabled="enableProxy !== true"
          v-model="proxy"
          placeholder="socks5://user:pass@127.0.0.1:1080/"
        />

        <label class="font-semibold mt-2" for="override-impersonate">
          {{ t('settings.network.impersonate.label') }}
        </label>
        <select
          id="override-impersonate"
          v-model="impersonate"
          class="select select-bordered"
        >
          <option
            v-for="preset in impersonatePresets"
            :key="preset.value"
            :value="preset.value"
          >
            {{ preset.label }}
          </option>
        </select>
        <span class="label">{{ t('settings.network.impersonate.hint') }}</span>
      </base-fieldset>

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
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseFieldset from '../base/BaseFieldset.vue';
import { SelectOption } from '../../helpers/forms.ts';
import { useMediaOptionsStore } from '../../stores/media/options.ts';
import { DownloadOverrides } from '../../tauri/types/media.ts';
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

const enableProxy = ref(false);
const proxy = ref('');
const impersonate = ref('none');
const headersText = ref('');

const impersonatePresets = computed<SelectOption[]>(() => ([
  { value: 'none', label: t('settings.network.impersonate.options.none') },
  { value: 'any', label: t('settings.network.impersonate.options.any') },
  { value: 'chrome-131:windows-10', label: 'Chrome 131 - Windows 10' },
  { value: 'chrome-131:macos-14', label: 'Chrome 131 - macOS 14' },
  { value: 'chrome-133:macos-15', label: 'Chrome 133 - macOS 15' },
  { value: 'chrome-131:android-14', label: 'Chrome 131 - Android 14' },
  { value: 'chrome-99:android-12', label: 'Chrome 99 - Android 12' },
  { value: 'edge-101:windows-10', label: 'Edge 101 - Windows 10' },
  { value: 'firefox-135:macos-14', label: 'Firefox 135 - macOS 14' },
  { value: 'firefox-133:macos-14', label: 'Firefox 133 - macOS 14' },
  { value: 'safari-18.4:ios-18.4', label: 'Safari 18.4 - iOS 18.4' },
  { value: 'safari-18.0:macos-15', label: 'Safari 18.0 - macOS 15' },
  { value: 'safari-17.0:macos-14', label: 'Safari 17.0 - macOS 14' },
  { value: 'safari-15.5:macos-14', label: 'Safari 15.5 - macOS 14' },
  { value: 'tor-14.5:macos-14', label: 'Tor 14.5 - macOS 14' },
]));

const parseHeaders = (value: string): string[] =>
  value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

const syncFromStore = () => {
  const current = optionsStore.getOverrides(props.groupId);
  enableProxy.value = current?.network?.enableProxy ?? false;
  proxy.value = current?.network?.proxy ?? '';
  impersonate.value = current?.network?.impersonate ?? 'none';
  headersText.value = (current?.auth?.headers ?? []).join('\n');
};

watch(() => props.groupId, syncFromStore, { immediate: true });

watch([enableProxy, proxy, impersonate, headersText], () => {
  const trimmedProxy = proxy.value.trim();
  const headers = parseHeaders(headersText.value);
  const globalNetwork = settingsStore.settings.network;

  const networkPayload = {
    enableProxy: enableProxy.value,
    proxy: trimmedProxy || undefined,
    impersonate: impersonate.value !== 'none' ? impersonate.value : undefined,
  };
  const hasNetwork =
    (globalNetwork.enableProxy ?? false) !== enableProxy.value
    || (globalNetwork.proxy ?? '') !== trimmedProxy
    || (globalNetwork.impersonate ?? 'none') !== impersonate.value;
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
});
</script>
