import { createApp, Ref } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './app.css';
import router from './router';
import { clearMocks } from '@tauri-apps/api/mocks';
import { installTauriMock } from '../tests/utils/tauriMock';
import tauriListeners from './plugins/tauriListeners';
import { useSettingsStore } from './stores/settings';
import { applyTheme } from './composables/useTheme';
import { mediaHandlers } from '../tests/utils/mocks/mediaHandlers';
import { configHandlers } from '../tests/utils/mocks/configHandlers';
import { binaryHandlers } from '../tests/utils/mocks/binaryHandlers';
import { updateHandlers } from '../tests/utils/mocks/updateHandlers';
import { invoke } from '@tauri-apps/api/core';
import { strongholdHandlers } from '../tests/utils/mocks/strongholdHandlers';
import { getDefaultLocale, i18n } from './i18n';
import { createSentryPiniaPlugin } from '@sentry/vue';
import { createSentry } from './sentry.ts';

const pinia = createPinia();
pinia.use(createSentryPiniaPlugin());
const app = createApp(App);

createSentry(app);

if (__E2E__) {
  clearMocks();
  installTauriMock({
    ...mediaHandlers,
    ...configHandlers,
    ...binaryHandlers,
    ...updateHandlers,
    ...strongholdHandlers,
  });
}

app.use(i18n);
app.use(router);
app.use(pinia);
app.use(tauriListeners);

const settingsStore = useSettingsStore();
settingsStore.load().then((settings) => {
  if (settings.appearance.theme !== 'system') {
    applyTheme(settings.appearance.theme);
  }
  const locale = i18n.global.locale as Ref<string>;
  locale.value = settings.appearance.language === 'system'
    ? getDefaultLocale()
    : settings.appearance.language;
  document.documentElement.setAttribute('lang', locale.value);
}).catch((e) => {
  console.error(e);
}).finally(() => {
  void invoke('app_ready');
  app.mount('#app');
});
