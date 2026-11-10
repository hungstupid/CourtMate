import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import type { Browser, Page } from '@playwright/test'
import type { Booking, Court, Review, Slot } from '../src/lib/types'
import { localDay } from '../src/lib/format'

export const marker = process.env.COURTMATE_E2E_MARKER!
export const password = 'Isolated-review-123!'
export const day = localDay(new Date(Date.now() + 3 * 86400000))
export const nextDay = localDay(new Date(Date.now() + 4 * 86400000))
export const photo = 'http://localhost:5173/e2e/fixtures/court-photo.jpg'

export async function actor(browser: Browser, suffix: string, owner = false) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5173' })
  const page = await context.newPage()
  const email = `${marker}-${suffix}-${randomUUID().slice(0, 8)}@courtmate.test`
  await page.goto('/register')
  // Refuse to create even an account when the developer server targets cloud.
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves this application module in local E2E.
    const { firebaseAuth } = await import('/src/lib/firebase.ts')
    // @ts-expect-error Vite serves this application module in local E2E.
    const { API_BASE_URL } = await import('/src/lib/api.ts')
    if (
      !firebaseAuth?.emulatorConfig ||
      !firebaseAuth.app.options.projectId.startsWith('demo-') ||
      !['localhost', '127.0.0.1'].includes(new URL(API_BASE_URL).hostname)
    )
      throw new Error('Review writes require the demo Firebase Auth Emulator')
  })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  if (owner) await page.getByRole('radio', { name: /Chủ sân/ }).check()
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page).toHaveURL(owner ? /\/owner$/ : /\/$/)
  return { context, page, email }
}

// Seed and inspect through the real authenticated API; no route interception.
// CI launches this local API using ensure_test_database() before the browser suite.
export async function api<T>(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      // @ts-expect-error Vite serves this application module in local E2E.
      const { apiRequest, API_BASE_URL } = await import('/src/lib/api.ts')
      if (!['localhost', '127.0.0.1'].includes(new URL(API_BASE_URL).hostname))
        throw new Error('Review writes require a local API')
      return apiRequest(path, { method, body })
    },
    { path, method, body }
  )
}

export async function court(
  page: Page,
  suffix: string,
  sport = 'Tennis',
  photos: string[] = []
) {
  const result = await api<Court>(page, '/api/owner/courts', 'POST', {
    name: `${marker} r${test.info().retry} ${suffix}`,
    sport,
    address: `12 Đường số 8, ${marker}`,
    area: marker,
    description: 'Sân kiểm thử local; không phải thông tin sân production.',
    base_price_vnd: 120000,
    max_players: 8,
    photo_urls: photos,
  })
  await api(page, `/api/owner/courts/${result.id}/hours`, 'PUT', {
    windows: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      opens_minute: 360,
      closes_minute: 1320,
    })),
  })
  return result
}

export async function slot(
  page: Page,
  courtId: string,
  hour: number,
  date = day,
  extra: Partial<Slot> = {}
) {
  return api<Slot>(page, `/api/owner/courts/${courtId}/slots`, 'POST', {
    start_at: `${date}T${String(hour).padStart(2, '0')}:00:00+07:00`,
    end_at: `${date}T${String(hour + 1).padStart(2, '0')}:00:00+07:00`,
    price_vnd: 120000,
    ...extra,
  })
}

export async function book(page: Page, slots: Slot[]) {
  const selection = { slot_ids: slots.map((s) => s.id) }
  const review = await api<Review>(
    page,
    '/api/bookings/review',
    'POST',
    selection
  )
  return api<Booking>(page, '/api/bookings', 'POST', {
    ...selection,
    quote: review.quote,
  })
}
