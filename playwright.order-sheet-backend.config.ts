import { defineConfig, devices } from '@playwright/test'
if (!process.env.E2E_BASE_URL) throw new Error('격리 Frontend의 E2E_BASE_URL이 필요합니다.')
export default defineConfig({
  testDir:'./tests/e2e', testMatch:'**/order-sheet-backend.spec.ts',workers:1,retries:0,timeout:120000,
  outputDir:'./test-results/order-sheet-backend',
  use:{baseURL:process.env.E2E_BASE_URL,...devices['Desktop Chrome'],trace:'off',screenshot:'only-on-failure'},
})
