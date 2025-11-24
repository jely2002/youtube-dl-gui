import { defineConfig, devices } from '@playwright/test';

const devPort = 1420;

export default defineConfig({
  webServer: {
    command: 'npm run dev',
    port: devPort,
    reuseExistingServer: !process.env.CI,
    env: {
      E2E: 'true',
    },
  },
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/utils/setup.ts',
  globalTeardown: './tests/e2e/utils/teardown.ts',
  use: {
    baseURL: `http://localhost:${devPort}`,
    viewport: { width: 800, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
