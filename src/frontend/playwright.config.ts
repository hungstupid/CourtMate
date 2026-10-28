import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // API failure injection is a local regression suite, separate from real cloud acceptance.
  testIgnore: process.env.E2E_BASE_URL ? '**/client.spec.ts' : undefined,
  timeout: 120000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    browserName: 'chromium',
    channel: process.env.BROWSER_CHANNEL || undefined,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
