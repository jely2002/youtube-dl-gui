import { createApp } from 'vue';
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
import { getDefaultLocale, i18n, type Locale } from './i18n';
import { createSentryPiniaPlugin } from '@sentry/vue';
import { createSentry } from './sentry.ts';
import { startWindowWatcher } from './tauri/window.ts';
import { usePreferencesStore } from './stores/preferences.ts';
import { useMediaStore } from './stores/media/media.ts';

const pinia = createPinia();
pinia.use(createSentryPiniaPlugin());
const app = createApp(App);

if (import.meta.env.DEV) {
  (globalThis as typeof globalThis & {
    __OVD_DEBUG__?: {
      pinia: typeof pinia;
      getStore: (id: string) => unknown;
    };
  }).__OVD_DEBUG__ = {
    pinia,
    getStore: (id: string) => (pinia as typeof pinia & { _s: Map<string, unknown> })._s.get(id),
  };
}

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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const mediaStore = useMediaStore();
    mediaStore.deleteAllGroups();
  });
}

const settingsStore = useSettingsStore();
const preferencesStore = usePreferencesStore();

initStores().catch((e) => {
  console.error(e);
}).finally(() => {
  void invoke('app_ready');
  if (!__E2E__) {
    startWindowWatcher();
  }
  app.mount('#app');
});

async function initStores(): Promise<void> {
  try {
    await preferencesStore.load();
  } catch (e) {
    console.error(`Unable to load preferences: ${e}`);
  }

  try {
    const settings = await settingsStore.load();
    if (settings.appearance.theme !== 'system') {
      applyTheme(settings.appearance.theme);
    }

    const currentLocale: Locale = settings.appearance.language === 'system'
      ? getDefaultLocale()
      : settings.appearance.language as Locale;

    i18n.global.locale.value = currentLocale;
    document.documentElement.setAttribute('lang', currentLocale);
  } catch (e) {
    console.error(`Unable to load settings: ${e}`);
  }
}
