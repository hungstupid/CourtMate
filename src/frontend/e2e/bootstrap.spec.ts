import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('frontend connects to the real API', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: /^Connected$/ })).toBeVisible({ timeout: 90000 })
  expect(errors).toEqual([])
})

test('Firebase account and backend Player role', async ({ page }) => {
  await page.goto('/')
  const email = process.env.E2E_EMAIL || `browser-${Date.now()}@courtmate.test`
  const password = process.env.E2E_PASSWORD || 'Local-browser-only-123!'
  if (process.env.E2E_BASE_URL && (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)) {
    throw new Error('Cloud E2E requires explicit test account credentials; no public account is created automatically.')
  }
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: process.env.E2E_EMAIL ? 'Sign in' : 'Register as Player', exact: true }).click()
  await expect(page.getByText('Signed in with Firebase.')).toBeVisible()
  await page.getByRole('button', { name: 'Verify with backend' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Backend verified' })).toContainText(process.env.E2E_ROLE || 'Player')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})

test('development page accessibility @a11y', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: /^Connected$/ })).toBeVisible({ timeout: 90000 })
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations).toEqual([])
})
