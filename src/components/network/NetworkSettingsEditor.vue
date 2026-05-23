<template>
  <div class="flex flex-col">
    <div class="mt-2 mb-4 flex flex-col gap-1">
      <label class="font-semibold" :for="enableProxyFieldId">
        {{ t('settings.network.enableProxy.label') }}
      </label>
      <input
        :id="enableProxyFieldId"
        type="checkbox"
        v-model="networkState.enableProxy"
        class="toggle toggle-primary my-1"
      />
    </div>

    <div class="mb-4 flex flex-col gap-1">
      <label class="font-semibold" :for="proxyFieldId">
        {{ t('settings.network.proxy.label') }}
      </label>
      <input
        :id="proxyFieldId"
        type="text"
        class="input"
        :disabled="networkState.enableProxy !== true"
        v-model="networkState.proxy"
        placeholder="socks5://user:pass@127.0.0.1:1080/"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label class="font-semibold" :for="impersonateFieldId">
        {{ t('settings.network.impersonate.label') }}
      </label>
      <select
        :id="impersonateFieldId"
        v-model="networkState.impersonate"
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
    </div>

    <slot name="after-common" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildImpersonatePresets } from '../../helpers/network.ts';
import type { NetworkSettings } from '../../tauri/types/config.ts';

const networkState = defineModel<NetworkSettings>({ required: true });

const { idPrefix } = defineProps({
  idPrefix: {
    type: String,
    required: false,
    default: '',
  },
});

const { t } = useI18n();

const impersonatePresets = computed(() => buildImpersonatePresets(t));
const enableProxyFieldId = computed(() => idPrefix ? `${idPrefix}-enable-proxy` : 'enableProxy');
const proxyFieldId = computed(() => idPrefix ? `${idPrefix}-proxy` : 'proxyUrl');
const impersonateFieldId = computed(() => idPrefix ? `${idPrefix}-impersonate` : 'impersonate');
</script>
