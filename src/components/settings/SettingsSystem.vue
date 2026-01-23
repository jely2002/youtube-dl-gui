<template>
  <base-fieldset
      :legend="t('settings.system.legend')"
      :label="t('settings.system.legendLabel')"
  >
    <label v-if="isMac" class="font-semibold mt-2" for="trayEnabled">
      {{ t('settings.system.trayEnabled.label.mac') }}
    </label>
    <label v-else class="font-semibold mt-2" for="trayEnabled">
      {{ t('settings.system.trayEnabled.label.generic') }}
    </label>
    <input
        id="trayEnabled"
        type="checkbox"
        v-model="settings.system.trayEnabled"
        class="toggle toggle-primary"
    />
    <p class="label" v-if="isMac">{{ t('settings.system.trayEnabled.hint.mac') }}</p>
    <p class="label" v-else>{{ t('settings.system.trayEnabled.hint.generic') }}</p>

    <template v-if="!isMac">
      <label class="font-semibold mt-2" for="minimiseToTray">
        {{ t('settings.system.minimiseToTray.label') }}
      </label>
      <input
          :disabled="settings.system.trayEnabled === false"
          id="minimiseToTray"
          type="checkbox"
          v-model="minimiseToTray"
          class="toggle toggle-primary"
      />
      <p class="label">{{ t('settings.system.minimiseToTray.hint') }}</p>
    </template>
    <label class="font-semibold mt-2" for="autoStart">
      {{ t('settings.system.autoStart.label') }}
    </label>
    <input
        id="autoStart"
        type="checkbox"
        v-model="settings.system.autoStartEnabled"
        class="toggle toggle-primary"
    />
    <p class="label">{{ t('settings.system.autoStart.hint') }}</p>
    <label v-if="!isMac" class="font-semibold mt-2" for="autoStartMinimised">
      {{ t('settings.system.autoStartMinimised.label.windows') }}
    </label>
    <label v-else-if="isMac" class="font-semibold mt-2" for="autoStartMinimised">
      {{ t('settings.system.autoStartMinimised.label.mac') }}
    </label>
    <label v-else class="font-semibold mt-2" for="autoStartMinimised">
      {{ t('settings.system.autoStartMinimised.label.generic') }}
    </label>
    <input
        :disabled="!settings.system.autoStartEnabled || (!isMac && !settings.system.trayEnabled)"
        id="autoStartMinimised"
        type="checkbox"
        v-model="settings.system.autoStartMinimised"
        class="toggle toggle-primary"
    />
    <p class="label" v-if="isMac">{{ t('settings.system.autoStartMinimised.hint.mac') }}</p>
    <p class="label" v-else-if="isWindows">{{ t('settings.system.autoStartMinimised.hint.windows') }}</p>
    <p class="label" v-else>{{ t('settings.system.autoStartMinimised.hint.generic') }}</p>  </base-fieldset>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { CloseBehavior, Settings } from '../../tauri/types/config.ts';
import { useI18n } from 'vue-i18n';
import { computed, watch } from 'vue';
import { usePlatform } from '../../composables/usePlatform.ts';

const { t } = useI18n();
const { isWindows, isMac } = usePlatform();

const settings = defineModel<Settings>({ required: true });
const minimiseToTray = computed<boolean>({
  get: () => settings.value.system.closeBehavior === CloseBehavior.Hide && settings.value.system.trayEnabled === true,
  set: (value) => {
    settings.value.system.closeBehavior = value ? CloseBehavior.Hide : CloseBehavior.Exit;
  },
});

watch(() => settings.value.system.trayEnabled, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    minimiseToTray.value = false;
  }
  if (!isMac.value) {
    settings.value.system.autoStartMinimised = false;
  }
});

watch(() => settings.value.system.autoStartEnabled, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    settings.value.system.autoStartMinimised = false;
  }
});
</script>
