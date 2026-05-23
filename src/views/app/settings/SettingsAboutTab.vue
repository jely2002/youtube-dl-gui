<template>
  <base-fieldset :legend="t('about.title')" label="">
    <div class="flex flex-col gap-2">
      <div class="flex gap-2 mb-2 w-full">
        <a href="https://github.com/jely2002/youtube-dl-gui" class="link link-subtle" target="_blank" rel="noopener">
          {{ t('about.links.github') }}
        </a>
        <hr class="divider divider-horizontal mx-0 border-none">
        <a href="https://github.com/jely2002/youtube-dl-gui/wiki" class="link" target="_blank" rel="noopener">
          {{ t('about.links.wiki') }}
        </a>
        <hr class="divider divider-horizontal mx-0 border-none">
        <a href="https://github.com/jely2002/youtube-dl-gui/issues/new?template=bug_report.md" class="link" target="_blank" rel="noopener">
          {{ t('about.links.reportABug') }}
        </a>
      </div>
      <p>{{ t('about.credit') }}</p>
      <div class="flex gap-2 items-center">
        <p>{{ t('about.poweredBy') }}</p>
        <button type="button" @click="openLicenses()" class="btn btn-soft btn-xs">
          {{ t('about.viewLicenses') }}
        </button>
      </div>
      <p>{{ t('about.version', { version: appVersion }) }}</p>
    </div>
  </base-fieldset>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BaseFieldset from '../../../components/base/BaseFieldset.vue';
import { useOpener } from '../../../composables/useOpener.ts';

defineOptions({
  inheritAttrs: false,
});

const { t } = useI18n();
const { openInternalPath } = useOpener();
const appVersion = typeof __APP_VERSION__ === 'undefined' ? '' : __APP_VERSION__;

const openLicenses = async () => {
  await openInternalPath('licenses/3rdpartylicenses.txt');
};
</script>
