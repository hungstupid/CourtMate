import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { actor, api, court } from './review-fixtures'

test.beforeEach(() => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Local test database/emulator only.'
  )
})

test('map provider blocked: explicit recovery retains address/origin and booking access', async ({
  browser,
}) => {
  const owner = await actor(browser, 'accept-map-blocked', true)
  try {
    const c = await court(owner.page, 'Map blocked')
    let requests = 0
    await owner.page.route('https://maps.google.com/**', (route) => {
      requests++
      return route.abort('failed')
    })
    await owner.page.goto(`/courts/${c.id}`)
    const summary = owner.page.getByText('Vị trí & chỉ đường', {
      exact: true,
    })
    await summary.focus()
    await owner.page.keyboard.press('Enter')
    await expect.poll(() => requests).toBe(1)
    await expect(
      owner.page.getByText(/Nếu bản đồ trống hoặc không tải được/)
    ).toBeVisible()
    const origin = owner.page.getByLabel('Điểm xuất phát', {
      exact: true,
    })
    await origin.fill('Thảo Cầm Viên Sài Gòn')
    const retry = owner.page.getByRole('button', {
      name: 'Thử tải lại bản đồ',
      exact: true,
    })
    await retry.focus()
    await owner.page.keyboard.press('Enter')
    await expect.poll(() => requests).toBe(2)
    await expect(retry).toBeFocused()
    await expect(origin).toHaveValue('Thảo Cầm Viên Sài Gòn')
    const link = owner.page.getByRole('link', {
      name: 'Mở chỉ đường ↗',
      exact: true,
    })
    const target = new URL((await link.getAttribute('href'))!)
    expect(target.searchParams.get('origin')).toBe(
      'Thảo Cầm Viên Sài Gòn'
    )
    expect(target.searchParams.get('destination')).toBe(c.address)
    for (const width of [375, 768, 1280]) {
      await owner.page.setViewportSize({ width, height: 900 })
      expect(
        await owner.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      expect(
        (
          await new AxeBuilder({ page: owner.page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations
      ).toEqual([])
    }
    await summary.click()
    await summary.click()
    await expect(origin).toHaveValue('Thảo Cầm Viên Sài Gòn')
    await owner.page
      .getByRole('link', { name: 'Xem giờ trống', exact: true })
      .click()
    await expect(owner.page).toHaveURL(
      new RegExp(`/courts/${c.id}/slots`)
    )
  } finally {
    await owner.context.close()
  }
})

test('map provider stalls: bounded loading, explicit retry and blank response never claim a verified map', async ({
  browser,
}) => {
  const owner = await actor(browser, 'accept-map-stall', true)
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    const c = await court(owner.page, 'Map stall')
    await owner.page.route(
      'https://maps.google.com/**',
      async (route) => {
        await pending
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="vi"><title>Unavailable provider fixture</title><body></body></html>',
        })
      }
    )
    await owner.page.goto(`/courts/${c.id}`)
    await owner.page.clock.install()
    await owner.page
      .getByText('Vị trí & chỉ đường', { exact: true })
      .click()
    await expect(owner.page.getByRole('status')).toHaveText(
      'Đang tải bản đồ…'
    )
    await owner.page.clock.fastForward(10001)
    await expect(owner.page.getByRole('status')).toContainText(
      'Bản đồ tải chậm hoặc không khả dụng'
    )
    await expect(
      owner.page.getByRole('link', {
        name: 'Xem vị trí trên bản đồ ↗',
        exact: true,
      })
    ).toBeVisible()
    await expect(
      owner.page.getByRole('button', {
        name: 'Nhập điểm đi để chỉ đường',
        exact: true,
      })
    ).toBeDisabled()
    release()
    await expect(owner.page.getByRole('status')).toHaveText(
      'Bản đồ do Google Maps cung cấp.'
    )
    await expect(
      owner.page.getByText(/Nếu bản đồ trống hoặc không tải được/)
    ).toBeVisible()
    await expect(
      owner.page.getByRole('button', {
        name: 'Thử tải lại bản đồ',
        exact: true,
      })
    ).toBeVisible()
  } finally {
    release()
    await owner.context.close()
  }
})

test('live Google Maps renders a known location and an explicit-origin route without GPS', async ({
  browser,
}) => {
  test.skip(
    process.env.COURTMATE_VERIFY_MAPS !== '1',
    'Opt-in third-party network verification; no fake provider response.'
  )
  const owner = await actor(browser, 'accept-map-live', true)
  try {
    const c = await court(owner.page, 'Map live')
    const address = 'Chợ Bến Thành, Thành phố Hồ Chí Minh'
    await api(owner.page, `/api/owner/courts/${c.id}`, 'PATCH', {
      address,
    })
    await owner.page.goto(`/courts/${c.id}`)
    const cdp = await owner.context.newCDPSession(owner.page)
    const { targetInfo } = await cdp.send('Target.getTargetInfo')
    await cdp.send('Browser.setPermission', {
      permission: { name: 'geolocation' },
      setting: 'denied',
      origin: 'http://localhost:5173',
      browserContextId: targetInfo.browserContextId,
    })
    await owner.page
      .getByText('Vị trí & chỉ đường', { exact: true })
      .click()
    const map = owner.page.frameLocator(
      `iframe[title="Bản đồ ${c.name}"]`
    )
    // Google draws the place label into the map; it is not an HTML text node
    // in narrow embeds. Provider content checks plus the reviewed screenshot
    // are distinct evidence; an iframe load event alone proves neither.
    await expect(
      map.getByText(/Dữ liệu bản đồ|Map data/).first()
    ).toBeVisible()
    await owner.page
      .locator('iframe')
      .screenshot({
        path: join(tmpdir(), 'courtmate-acceptance-map.png'),
      })
    expect(
      await owner.page.evaluate(
        async () =>
          (await navigator.permissions.query({ name: 'geolocation' }))
            .state
      )
    ).toBe('denied')
    await owner.page
      .getByLabel('Điểm xuất phát', { exact: true })
      .fill('Thảo Cầm Viên Sài Gòn')
    const href = await owner.page
      .getByRole('link', { name: 'Mở chỉ đường ↗', exact: true })
      .getAttribute('href')
    const routePage = await owner.context.newPage()
    await routePage.goto(href!, { waitUntil: 'domcontentloaded' })
    await expect(routePage.getByRole('main').first()).toContainText(
      /km/,
      {
        timeout: 30000,
      }
    )
    await routePage.screenshot({
      path: join(tmpdir(), 'courtmate-acceptance-route.png'),
    })
    await expect(routePage.getByRole('textbox').first()).toHaveValue(
      /Thảo Cầm Viên|Saigon Zoo/
    )
    await expect(routePage.getByRole('textbox').nth(1)).toHaveValue(
      /Chợ Bến Thành|Ben Thanh Market/
    )
  } finally {
    await owner.context.close()
  }
})
