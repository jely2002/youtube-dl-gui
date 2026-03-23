<template>
  <base-fieldset
      :legend="t('settings.network.legend')"
      :label="t('settings.network.legendLabel')"
  >
    <label class="font-semibold mt-2" for="enableProxy">
      {{ t('settings.network.enableProxy.label') }}
    </label>
    <input
        id="enableProxy"
        type="checkbox"
        v-model="settings.network.enableProxy"
        class="toggle toggle-primary"
    />
    <label class="font-semibold mt-2" for="proxyUrl">
      {{ t('settings.network.proxy.label') }}
    </label>
    <input
        type="text"
        id="proxyUrl"
        class="input mb-2"
        :disabled="settings.network.enableProxy !== true"
        v-model="settings.network.proxy"
        placeholder="socks5://user:pass@127.0.0.1:1080/"
    />
    <label class="font-semibold" for="impersonate">
      {{ t('settings.network.impersonate.label') }}
    </label>
    <select
        id="impersonate"
        v-model="settings.network.impersonate"
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
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';
import { SelectOption } from '../../helpers/forms.ts';
import { computed, ComputedRef } from 'vue';
import { buildImpersonatePresets } from '../../helpers/network.ts';

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const impersonatePresets: ComputedRef<SelectOption[]> = computed(() =>
  buildImpersonatePresets(t),
);
</script>
