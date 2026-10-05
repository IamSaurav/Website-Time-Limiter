import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4610' },
  webServer: {
    command: 'node test/serve.mjs 4610',
    url: 'http://localhost:4610/timewaster.html',
    reuseExistingServer: true,
  },
});
