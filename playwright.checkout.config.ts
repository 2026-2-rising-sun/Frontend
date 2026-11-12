import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/checkout-ui.spec.ts', workers: 1, timeout: 30000,
  outputDir: './test-results/checkout-ui',
  use: { baseURL: 'http://127.0.0.1:5377', ...devices['Desktop Chrome'], screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5377', url: 'http://127.0.0.1:5377', reuseExistingServer: true },
})
