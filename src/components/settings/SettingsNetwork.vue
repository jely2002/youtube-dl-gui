<template>
  <base-fieldset
      :legend="t('settings.network.legend')"
      :label="t('settings.network.legendLabel')"
  >
    <label class="font-semibold mt-2" for="proxyUrl">
      {{ t('settings.network.proxy.label') }}
    </label>
    <input
        type="text"
        id="proxyUrl"
        class="input mb-2"
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

const { t } = useI18n();
const settings = defineModel<Settings>({ required: true });

const impersonatePresets: ComputedRef<SelectOption[]> = computed(() => ([
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
</script>
