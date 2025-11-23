<template>
  <div role="alert" data-testid="auth-init-alert" class="alert alert-soft alert-horizontal max-w-4xl" :class="{ 'alert-info': !hasError, 'alert-error': hasError }">
    <exclamation-circle-icon v-if="hasError" class="w-6 h-6"/>
    <key-icon v-else class="w-6 h-6"/>
    <div>
      <h3 class="font-bold">
        {{
          hasError
              ? t('auth.init.error.title')
              : t('auth.init.title')
        }}
      </h3>
      <p class="text-xs">
        {{
          hasError
          ? t('auth.init.error.description')
          : t('auth.init.description')
        }}
      </p>
      <p class="text-xs">
        {{
          hasError
              ? t('auth.init.error.hint', { error: strongholdStore.status.initError ?? t('auth.init.error.unknown') })
              : t('auth.init.hint')
        }}
      </p>
    </div>
    <div>
      <base-button
          :class="{ 'btn-info': !hasError, 'btn-error': hasError }"
          :loading="isInitializing"
          type="button"
          @click="initialize()"
      >
        {{ hasError ? t('common.retry') : t('common.enable') }}
      </base-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeyIcon, ExclamationCircleIcon } from '@heroicons/vue/24/solid';
import { useStrongholdStore } from '../../stores/stronghold';
import { computed, ref } from 'vue';
import { useToastStore } from '../../stores/toast';
import BaseButton from '../base/BaseButton.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const strongholdStore = useStrongholdStore();
const toastStore = useToastStore();

const isInitializing = ref(false);

const hasError = computed(() => strongholdStore.status.initError != null);

const initialize = async () => {
  try {
    isInitializing.value = true;
    await strongholdStore.initialize();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    toastStore.showToast(t('auth.init.toasts.error', { error: message }), {
      style: 'error',
      duration: 5000,
    });
  } finally {
    isInitializing.value = false;
  }
};
</script>
