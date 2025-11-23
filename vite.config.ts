import { defineConfig, UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import vueDevTools from 'vite-plugin-vue-devtools';

const host = process.env.TAURI_DEV_HOST;

const isE2E = process.env.E2E === 'true';
const isDev = process.env.DEV === 'true';

export default defineConfig((): UserConfig => ({
  plugins: [
    vue(),
    isDev && !isE2E && vueDevTools({
      launchEditor: 'idea',
    }),
    tailwindcss(),
  ],
  define: {
    __DEV__: isDev,
    __E2E__: isE2E,
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**', '!**/src-tauri/tauri.conf.json', '**/coverage/**', '**/manifest/**', '**/test-results/**'],
    },
  },
}));
