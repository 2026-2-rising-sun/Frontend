import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/refunds-ui.spec.ts', workers: 1, timeout: 30000,
  outputDir: './test-results/refunds-ui',
  use: { baseURL: 'http://127.0.0.1:5384', ...devices['Desktop Chrome'], screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5384', url: 'http://127.0.0.1:5384', reuseExistingServer: !process.env.CI },
})
