import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages',
  timeout: 180_000,
  use: { baseURL: 'http://127.0.0.1:4175/pages-smoke/', headless: true },
  webServer: {
    command: 'node tests/static-server.mjs',
    url: 'http://127.0.0.1:4175/pages-smoke/',
    reuseExistingServer: false,
  },
});
