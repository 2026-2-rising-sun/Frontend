import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/features/*-ui.spec.ts', '**/catalog-filters-ui.spec.ts', '**/viewers-ui.spec.ts'],
  workers: 1,
  timeout: 30000,
  outputDir: './test-results/ui',
  use: { baseURL: 'http://127.0.0.1:5399', ...devices['Desktop Chrome'], screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5399', url: 'http://127.0.0.1:5399', reuseExistingServer: false },
})
