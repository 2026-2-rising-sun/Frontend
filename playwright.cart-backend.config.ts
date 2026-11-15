import { defineConfig, devices } from '@playwright/test'
if (!process.env.E2E_BASE_URL) throw new Error('격리 Frontend의 E2E_BASE_URL이 필요합니다.')
export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/cart-backend-compat.spec.ts', workers: 1, retries: 0, timeout: 90000,
  outputDir: './test-results/cart-backend',
  use: { baseURL: process.env.E2E_BASE_URL, ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
