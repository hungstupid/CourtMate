import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('frontend connects to the real API', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/development')
  await expect(
    page.getByRole('status').filter({ hasText: /^Connected$/ })
  ).toBeVisible({ timeout: 90000 })
  expect(errors).toEqual([])
})

test('Firebase session persists and sign-out removes protected access', async ({
  page,
}) => {
  await page.goto(process.env.E2E_EMAIL ? '/login' : '/register')
  const marker = process.env.COURTMATE_E2E_MARKER || 'e2e-local'
  const email = process.env.E2E_EMAIL || `${marker}-session@courtmate.test`
  const password = process.env.E2E_PASSWORD || 'Local-browser-only-123!'
  if (
    process.env.E2E_BASE_URL &&
    (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
  )
    throw new Error(
      'Cloud auth checks require explicit existing test credentials.'
    )
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page
    .getByRole('button', {
      name: process.env.E2E_EMAIL ? 'Đăng nhập' : 'Tạo tài khoản',
      exact: true,
    })
    .click()
  await expect(page).not.toHaveURL(/\/(login|register)$/)
  await page.goto('/profile')
  await expect(
    page.getByRole('heading', { name: 'Thông tin cá nhân' })
  ).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Vai trò', { exact: true })).toHaveValue(
    process.env.E2E_ROLE === 'Court Owner'
      ? 'Chủ sân (Court Owner)'
      : 'Người chơi (Player)'
  )
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/bookings')
  await expect(page).toHaveURL(/\/login$/)
})

test('court discovery accessibility @a11y', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Khám phá sân chơi' })
  ).toBeVisible()
  await expect(page.getByText('Đang tải sân…', { exact: true })).toHaveCount(
    0,
    { timeout: 90000 }
  )
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
