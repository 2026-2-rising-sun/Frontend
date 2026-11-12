import { defineConfig, devices } from '@playwright/test'
const prism = process.env.E2E_MODE === 'prism'
const features = process.env.E2E_MODE === 'features'
const baseURL = process.env.E2E_BASE_URL ?? (prism ? 'http://127.0.0.1:5274' : 'http://127.0.0.1:5174')
export default defineConfig({
  testDir: './tests/e2e', testMatch: prism ? '**/prism.spec.ts' : features ? '**/features/*.spec.ts' : '**/kind.spec.ts',
  outputDir: './test-results/' + (prism ? 'prism' : features ? 'features' : 'kind'),
  fullyParallel: false, workers: 1, retries: 0, timeout: 45000,
  expect: { timeout: 10000 }, reporter: [['list'], ['json', { outputFile: `test-artifacts/${prism ? 'prism' : features ? 'features' : 'kind'}-results.json` }]],
  use: { baseURL, ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_EXTERNAL_SERVER === 'true' ? undefined : { command: 'node scripts/local-frontend.mjs' + (prism ? ' --prism' : ''), url: baseURL + '/api/member/v1/members/me', reuseExistingServer: !process.env.CI, timeout: 300000 },
})
