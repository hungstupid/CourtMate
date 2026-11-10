import { randomUUID } from 'node:crypto'
import { defineConfig } from '@playwright/test'

process.env.COURTMATE_E2E_MARKER ||= `e2e-${randomUUID().replaceAll("-", "")}`

export default defineConfig({
  globalTeardown: process.env.E2E_BASE_URL ? undefined : "./e2e/cleanup.ts",
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
