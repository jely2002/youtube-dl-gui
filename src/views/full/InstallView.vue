<template>
  <base-sub-nav :backButton="false" class="bg-base-300">
    <template v-slot:default>
      <base-button :disabled="isInstalling" :class="{ 'btn-primary': !installPartialFail, 'btn-subtle': installPartialFail }" to="/">
        <template v-if="isInstalling">
          {{ t('common.pleaseWait') }}
        </template>
        <template v-else-if="!installPartialFail">
          {{ t('common.parenthesis', { content: waitTime }) }} {{ t('common.continue') }} <arrow-right-icon class="w-4 h-4"/>
        </template>
        <template v-else>
          {{ t('common.continue') }} <arrow-right-icon class="w-4 h-4"/>
        </template>
      </base-button>
    </template>
    <template v-slot:title>
      <div>
        <h1 v-if="isInstalling" class="text-lg font-semibold self-center">{{ t('install.title.installing') }}</h1>
        <h1 v-else-if="installPartialFail" class="text-lg font-semibold self-center">{{ t('install.title.failed') }}</h1>
        <h1 v-else class="text-lg font-semibold self-center">{{ t('install.title.installed') }}</h1>
        <p v-if="isInstalling">{{ t('install.subtitle.installing') }}</p>
        <p v-else-if="installPartialFail">{{ t('install.subtitle.failed') }}</p>
        <p v-else>{{ t('install.subtitle.installed') }}</p>
      </div>
    </template>
  </base-sub-nav>
  <div class="flex flex-col gap-4 p-6">
    <tool-card v-for="[name, tool] in Object.entries(tools)" :key="name" :tool="tool" :name="name"/>
  </div>
</template>

<script setup lang="ts">
import { useBinariesStore } from '../../stores/binaries';
import { ArrowRightIcon } from '@heroicons/vue/24/solid';
import { computed, onMounted, ref } from 'vue';
import BaseSubNav from '../../components/base/BaseSubNav.vue';
import BaseButton from '../../components/base/BaseButton.vue';
import { useRouter } from 'vue-router';
import ToolCard from '../../components/tool-card/ToolCard.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const binariesStore = useBinariesStore();
const router = useRouter();

const tools = computed(() => binariesStore.tools);
const isInstalling = ref(true);
const waitTime = ref(5);
const installPartialFail = ref(false);

onMounted(async () => {
  await ensureBinaries();
});

const ensureBinaries = async () => {
  try {
    await binariesStore.ensure();
    isInstalling.value = false;
    startCountdown();
  } catch (e) {
    installPartialFail.value = true;
    console.error(e);
  } finally {
    isInstalling.value = false;
  }
};

const startCountdown = () => {
  const ref = setInterval(() => {
    waitTime.value = waitTime.value - 1;
  }, 1000);
  setTimeout(() => {
    clearInterval(ref);
    void router.push('/');
  }, 5000);
};
</script>
