import { expect, test } from '@playwright/test'

test('API client handles HTTP errors without echoing provider payloads', async ({ page }) => {
  await page.goto('/')
  for (const status of [401, 403, 409, 422, 500, 503]) {
    await page.route('**/regression-client', (route) => route.fulfill({
      status, contentType: 'application/json', body: '{"detail":"private-provider-sentinel"}',
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173' },
    }))
    const result = await page.evaluate(async () => {
      // @ts-expect-error Vite serves this local source module in the regression runner.
      const { apiRequest } = await import('/src/lib/api.ts')
      try { await apiRequest('/regression-client', { authenticated: false }) }
      catch (error) { const value = error as { status: number; message: string }; return { status: value.status, message: value.message } }
    })
    expect(result?.status).toBe(status)
    expect(result?.message).not.toContain('private-provider-sentinel')
    await page.unroute('**/regression-client')
  }
})

test('API client cancels, times out, handles network failure and sends JSON', async ({ page }) => {
  await page.goto('/')
  await page.route('**/regression-client', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type',
      } })
    } else await route.fulfill({ status: 200, contentType: 'application/json', body: route.request().postData() || '{}', headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173' } })
  })
  expect(await page.evaluate(async () => {
    // @ts-expect-error Vite local module.
    const { apiRequest } = await import('/src/lib/api.ts')
    return apiRequest('/regression-client', { method: 'POST', body: { example: 1 }, authenticated: false })
  })).toEqual({ example: 1 })
  await page.unroute('**/regression-client')
  await page.route('**/regression-client', (route) => route.abort('failed'))
  expect(await page.evaluate(async () => {
    // @ts-expect-error Vite local module.
    const { apiRequest } = await import('/src/lib/api.ts')
    try { await apiRequest('/regression-client', { authenticated: false }) }
    catch (error) { return (error as { kind: string }).kind }
  })).toBe('network')
  await page.unroute('**/regression-client')
  await page.route('**/regression-client', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    await route.abort().catch(() => {})
  })
  const outcomes = await page.evaluate(async () => {
    // @ts-expect-error Vite local module.
    const { apiRequest } = await import('/src/lib/api.ts')
    const cancelled = new AbortController()
    cancelled.abort()
    const values = []
    for (const options of [{ signal: cancelled.signal }, { timeoutMs: 10 }]) {
      try { await apiRequest('/regression-client', { ...options, authenticated: false }) }
      catch (error) { values.push((error as { kind: string }).kind) }
    }
    return values
  })
  expect(outcomes).toEqual(['cancelled', 'timeout'])
})

test('session loading, provider outage, retry and expiry fail closed', async ({ page }) => {
  await page.goto('/account')
  await page.getByLabel('Email', { exact: true }).fill(`session-${Date.now()}@courtmate.test`)
  await page.getByLabel('Password', { exact: true }).fill('Local-session-only-123!')
  let mode = 'offline'
  await page.route('**/api/me', async (route) => {
    if (mode === 'ready') return route.continue()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.fulfill({ status: mode === 'expired' ? 401 : 503, contentType: 'application/json', body: '{}', headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173' } })
  })
  await page.getByRole('button', { name: 'Register as Player' }).click()
  await expect(page.getByText('Loading session…', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Account foundation' })).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  mode = 'ready'
  await page.getByRole('button', { name: 'Verify with backend' }).click()
  await expect(page.getByRole('heading', { name: 'Account foundation' })).toBeVisible()
  mode = 'expired'
  await page.getByRole('button', { name: 'Verify with backend' }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('session expired')
  await expect(page.getByRole('heading', { name: 'Account foundation' })).toHaveCount(0)
})
