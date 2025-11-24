<template>
  <details data-testid="auth-details" class="collapse collapse-arrow bg-base-100 border-base-300 border max-w-4xl" :open="strongholdStore.hasAvailableKeys()">
    <summary class="collapse-title font-semibold">
      <h3 class="text-lg">{{ t('auth.credentials.title') }}</h3>
      <span class="label text-[0.75rem] font-normal">{{ t('auth.credentials.description') }}</span>
    </summary>
    <div class="collapse-content">
      <credentials-init
          v-if="!strongholdStore.status.unlocked"
      />
      <div v-else>
        <base-fieldset
            :legend="t('auth.credentials.basicAuth.legend')"
            :label="t('auth.credentials.basicAuth.legendLabel')"
        >
          <base-secret-input
              v-model="strongholdFields.username"
              id="basic-auth-username"
              :label="t('auth.credentials.labels.username')"
          />
          <base-secret-input
              v-model="strongholdFields.password"
              :password="true"
              id="basic-auth-password"
              :label="t('auth.credentials.labels.password')"
          />
        </base-fieldset>

        <div class="divider my-2" />

        <base-fieldset
            :legend="t('auth.credentials.videoPassword.legend')"
            :label="t('auth.credentials.videoPassword.legendLabel')"
        >
          <base-secret-input
              v-model="strongholdFields.videoPassword"
              :password="true"
              id="video-password"
              :label="t('auth.credentials.labels.password')"
          />
        </base-fieldset>

        <div class="divider my-2" />

        <base-fieldset
            :legend="t('auth.credentials.bearerToken.legend')"
            :label="t('auth.credentials.bearerToken.legendLabel')"
        >
          <base-secret-input
              v-model="strongholdFields.bearer"
              :password="true"
              id="bearer-token"
              :label="t('auth.credentials.labels.token')"
          />
        </base-fieldset>

        <div class="divider my-2" />

        <base-fieldset
            :legend="t('auth.credentials.customHeaders.legend')"
            :badge="t('auth.credentials.customHeaders.legendBadge')"
            :label="t('auth.credentials.customHeaders.legendLabel')"
        >
          <label for="custom-headers" class="label">
            <span class="font-semibold">{{ t('auth.credentials.labels.headers') }}</span>
          </label>
          <textarea
              class="textarea rounded-xl w-full"
              rows="3"
              id="custom-headers"
              v-model="strongholdFields.headers"
              :placeholder="t('auth.credentials.customHeaders.placeholder')"
          />
        </base-fieldset>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import BaseFieldset from '../base/BaseFieldset.vue';
import { StrongholdFields, useStrongholdStore } from '../../stores/stronghold';
import CredentialsInit from './CredentialsInit.vue';
import BaseSecretInput from '../base/BaseSecretInput.vue';
import { PropType } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const strongholdStore = useStrongholdStore();

const strongholdFields = defineModel({
  type: Object as PropType<StrongholdFields>,
  required: true,
});
</script>
