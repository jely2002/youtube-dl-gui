import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      reportsDirectory: 'coverage/units',
      reporter: ['html', 'lcovonly', 'text'],
    },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.ts'],
  },
});
