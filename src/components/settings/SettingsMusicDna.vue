<template>
  <base-fieldset
    :legend="t('settings.musicDna.legend')"
    :badge="t('settings.musicDna.legendBadge')"
    :label="t('settings.musicDna.legendLabel')"
  >
    <label class="font-semibold mt-2" for="musicDnaEnabled">
      {{ t('settings.musicDna.enabled.label') }}
    </label>
    <input
      id="musicDnaEnabled"
      type="checkbox"
      v-model="settings.musicDna.enabled"
      class="toggle toggle-primary"
    />

    <label class="font-semibold mt-2" for="musicDnaProvider">
      {{ t('settings.musicDna.providerBaseUrl.label') }}
    </label>
    <input
      id="musicDnaProvider"
      type="url"
      class="input"
      v-model="settings.musicDna.providerBaseUrl"
    />

    <label class="font-semibold mt-2" for="musicDnaModel">
      {{ t('settings.musicDna.model.label') }}
    </label>
    <input
      id="musicDnaModel"
      type="text"
      class="input"
      v-model="settings.musicDna.model"
    />

    <label class="font-semibold mt-2" for="musicDnaMaxSuggestions">
      {{ t('settings.musicDna.maxSuggestions.label') }}
    </label>
    <input
      id="musicDnaMaxSuggestions"
      type="number"
      class="input"
      min="1"
      max="5"
      v-model.number="settings.musicDna.maxSuggestions"
    />

    <label class="font-semibold mt-2" for="musicDnaTargetRegion">
      {{ t('settings.musicDna.targetRegion.label') }}
    </label>
    <input
      id="musicDnaTargetRegion"
      type="text"
      class="input"
      v-model="settings.musicDna.targetRegion"
    />

    <label class="font-semibold mt-2" for="musicDnaFocusGenres">
      {{ t('settings.musicDna.focusGenres.label') }}
    </label>
    <input
      id="musicDnaFocusGenres"
      type="text"
      class="input"
      :value="settings.musicDna.focusGenres.join(', ')"
      @input="onFocusGenresInput"
    />
    <p class="label">{{ t('settings.musicDna.focusGenres.hint') }}</p>

    <div class="grid grid-cols-2 gap-3 mt-2">
      <label class="font-semibold" for="musicDnaGenreWeight">{{ t('settings.musicDna.weights.genre') }}</label>
      <input id="musicDnaGenreWeight" type="number" step="0.05" min="0" max="1" class="input" v-model.number="settings.musicDna.weights.genre" />

      <label class="font-semibold" for="musicDnaRegionWeight">{{ t('settings.musicDna.weights.region') }}</label>
      <input id="musicDnaRegionWeight" type="number" step="0.05" min="0" max="1" class="input" v-model.number="settings.musicDna.weights.region" />

      <label class="font-semibold" for="musicDnaEraWeight">{{ t('settings.musicDna.weights.era') }}</label>
      <input id="musicDnaEraWeight" type="number" step="0.05" min="0" max="1" class="input" v-model.number="settings.musicDna.weights.era" />

      <label class="font-semibold" for="musicDnaInstrumentationWeight">{{ t('settings.musicDna.weights.instrumentation') }}</label>
      <input id="musicDnaInstrumentationWeight" type="number" step="0.05" min="0" max="1" class="input" v-model.number="settings.musicDna.weights.instrumentation" />

      <label class="font-semibold" for="musicDnaMoodWeight">{{ t('settings.musicDna.weights.mood') }}</label>
      <input id="musicDnaMoodWeight" type="number" step="0.05" min="0" max="1" class="input" v-model.number="settings.musicDna.weights.mood" />
    </div>

    <p class="font-semibold mt-3">{{ t('settings.musicDna.apiKey.label') }}</p>
    <router-link class="text-primary group font-semibold flex gap-1 items-center" :to="{ name: 'authentication' }">
      {{ t('settings.musicDna.apiKey.link') }}
      <arrow-right-icon class="w-5 h-5 group-focus:translate-x-1 group-hover:translate-x-1 transition-transform" />
    </router-link>
  </base-fieldset>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BaseFieldset from '../base/BaseFieldset.vue';
import { Settings } from '../../tauri/types/config.ts';
import { splitCsv } from '../../helpers/musicDna.ts';
import { ArrowRightIcon } from '@heroicons/vue/24/solid';

const settings = defineModel<Settings>({ required: true });
const { t } = useI18n();

const onFocusGenresInput = (event: Event): void => {
  if (!(event.target instanceof HTMLInputElement)) return;
  settings.value.musicDna.focusGenres = splitCsv(event.target.value);
};
</script>
