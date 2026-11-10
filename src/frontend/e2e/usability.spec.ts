import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import type { Booking, Slot } from '../src/lib/types'
import {
  actor,
  api,
  book,
  court,
  day,
  nextDay,
  photo,
  slot,
} from './review-fixtures'

test.beforeEach(() =>
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Usability writes use only the guarded local API/demo emulator.'
  )
)

async function a11y(page: Page) {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: `/private/tmp/courtmate-ux-${test
        .info()
        .title.slice(0, 45)
        .replace(/[^a-zA-Z0-9-]/g, '-')}-${width}.png`,
      fullPage: false,
    })
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([])
  }
}
async function keep(page: Page) {
  const dialog = page.getByRole('dialog', {
    name: 'Bỏ thay đổi chưa lưu?',
    exact: true,
  })
  await expect(dialog).toBeVisible()
  await dialog
    .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
}
async function discard(page: Page) {
  await page
    .getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?', exact: true })
    .getByRole('button', { name: 'Bỏ thay đổi và tiếp tục', exact: true })
    .click()
}

test('UC-05 real QUOTE_CHANGED preserves selection and requires explicit acceptance of each new backend total', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-quote-owner', true)
  const player = await actor(browser, 'ux-quote-player')
  try {
    const c = await court(owner.page, 'Reprice')
    const a = await slot(owner.page, c.id, 8),
      b = await slot(owner.page, c.id, 9)
    await player.page.goto(`/courts/${c.id}/slots?date=${day}`)
    await player.page.locator('.slot-row').nth(0).click()
    await player.page.locator('.slot-row').nth(1).click()
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(
      player.page.getByRole('dialog').locator('.total')
    ).toContainText('240.000')
    await api(owner.page, `/api/owner/slots/${a.id}`, 'PATCH', {
      price_vnd: 150000,
    })
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(player.page.getByRole('dialog')).toContainText(
      'Giá đã thay đổi · Chưa có booking được tạo'
    )
    await expect(
      player.page.getByRole('dialog').locator('.total')
    ).toContainText('270.000')
    await expect(
      player.page.locator('.slot-row[aria-pressed="true"]')
    ).toHaveCount(2)
    expect(await api(player.page, '/api/bookings')).toEqual([])
    await a11y(player.page)
    await api(owner.page, `/api/owner/slots/${a.id}`, 'PATCH', {
      price_vnd: 180000,
    })
    await player.page
      .getByRole('button', { name: 'Xác nhận lại giá mới', exact: true })
      .click()
    await expect(
      player.page.getByRole('dialog').locator('.total')
    ).toContainText('300.000')
    expect(await api(player.page, '/api/bookings')).toEqual([])
    await player.page.keyboard.press('Escape')
    await expect(
      player.page.locator('.slot-row[aria-pressed="true"]')
    ).toHaveCount(2)
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(
      player.page.getByRole('dialog').locator('.total')
    ).toContainText('300.000')
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/bookings\/[a-f0-9-]+$/)
    const bookings = await api<Booking[]>(player.page, '/api/bookings')
    expect(bookings).toHaveLength(1)
    expect(bookings[0]).toMatchObject({
      status: 'CONFIRMED',
      total_price_vnd: 300000,
    })
    expect(bookings[0].slots.map((s) => s.slot_id)).toEqual([a.id, b.id])
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('UC-05 real conflict removes only unavailable choices and keeps remaining valid slot', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-conflict-owner', true),
    player = await actor(browser, 'ux-conflict-player'),
    other = await actor(browser, 'ux-conflict-other')
  try {
    const c = await court(owner.page, 'Conflict'),
      a = await slot(owner.page, c.id, 8),
      b = await slot(owner.page, c.id, 9)
    await player.page.goto(`/courts/${c.id}/slots?date=${day}`)
    await player.page.locator('.slot-row').nth(0).click()
    await player.page.locator('.slot-row').nth(1).click()
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(player.page.getByRole('dialog')).toBeVisible()
    await book(other.page, [a])
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(player.page.getByRole('dialog')).toHaveCount(0)
    await expect(player.page.locator('.slot-row').nth(0)).toBeDisabled()
    await expect(player.page.locator('.slot-row').nth(1)).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(await api(player.page, '/api/bookings')).toEqual([])
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(player.page.getByRole('dialog')).toContainText('60 phút')
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/bookings\/[a-f0-9-]+$/)
    expect(
      (await api<Booking[]>(player.page, '/api/bookings'))[0].slots.map(
        (s) => s.slot_id
      )
    ).toEqual([b.id])
  } finally {
    await owner.context.close()
    await player.context.close()
    await other.context.close()
  }
})

test('UC-09 Owner batch drafts survive Keep on court/date/navigation/back; explicit discard publishes nothing', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-draft', true)
  try {
    const a = await court(owner.page, 'Draft A'),
      b = await court(owner.page, 'Draft B')
    await owner.page.goto('/owner')
    await owner.page
      .locator('article')
      .filter({
        has: owner.page.getByRole('heading', { name: a.name, exact: true }),
      })
      .getByRole('link', { name: 'Lịch sân', exact: true })
      .click()
    await owner.page.getByLabel('Ngày xem lịch', { exact: true }).fill(day)
    await owner.page
      .getByRole('button', { name: 'Tạo nhanh nhiều slot', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Tạo / thay danh sách nháp', exact: true })
      .click()
    await owner.page.getByLabel('Giá dòng 1', { exact: true }).fill('95000')
    await owner.page
      .getByLabel('Sân đang quản lý', { exact: true })
      .selectOption(b.id)
    await keep(owner.page)
    await expect(
      owner.page.getByLabel('Sân đang quản lý', { exact: true })
    ).toHaveValue(a.id)
    await owner.page.getByLabel('Ngày xem lịch', { exact: true }).fill(nextDay)
    await keep(owner.page)
    await expect(
      owner.page.getByLabel('Ngày xem lịch', { exact: true })
    ).toHaveValue(day)
    await owner.page.setViewportSize({ width: 1280, height: 900 })
    await owner.page
      .getByRole('navigation', { name: 'Điều hướng chính', exact: true })
      .getByRole('link', { name: 'Sân của tôi', exact: true })
      .click()
    await keep(owner.page)
    await owner.page.evaluate(() => history.back())
    await keep(owner.page)
    await expect(
      owner.page.getByLabel('Giá dòng 1', { exact: true })
    ).toHaveValue('95000')
    expect(
      await owner.page.evaluate(() => {
        const e = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(e)
        return e.defaultPrevented
      })
    ).toBe(true)
    await a11y(owner.page)
    await owner.page
      .getByRole('button', { name: 'Hủy nháp, không công bố', exact: true })
      .click()
    await discard(owner.page)
    await expect(
      owner.page.getByRole('heading', { name: '8 slot nháp', exact: true })
    ).toHaveCount(0)
    expect(await api(owner.page, `/api/owner/courts/${a.id}/slots`)).toEqual([])
    await owner.page
      .getByLabel('Sân đang quản lý', { exact: true })
      .selectOption(b.id)
    await expect(
      owner.page.getByLabel('Sân đang quản lý', { exact: true })
    ).toHaveValue(b.id)
    await expect(owner.page.getByRole('dialog')).toHaveCount(0)
  } finally {
    await owner.context.close()
  }
})

test('UC-09 slot editor Escape and Close protect edited inputs, focus and native unload', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-editor', true)
  try {
    const c = await court(owner.page, 'Editor')
    await owner.page.goto(`/owner/schedule?court=${c.id}&date=${day}`)
    await owner.page
      .getByRole('button', { name: '+ Thêm slot', exact: true })
      .click()
    const editor = owner.page.getByRole('dialog', {
      name: 'Thêm một slot',
      exact: true,
    })
    const price = editor.getByLabel('Giá cả slot (₫)', { exact: true })
    await price.fill('99000')
    await owner.page.keyboard.press('Escape')
    await keep(owner.page)
    await expect(price).toHaveValue('99000')
    await expect(price).toBeFocused()
    const unload = owner.page.waitForEvent('dialog')
    const reload = owner.page.reload({ timeout: 10000 }).catch(() => null)
    const warning = await unload
    expect(warning.type()).toBe('beforeunload')
    await warning.dismiss()
    await reload
    await expect(price).toHaveValue('99000')
    await editor
      .getByRole('button', { name: 'Đóng hộp thoại', exact: true })
      .click()
    await discard(owner.page)
    await expect(editor).toHaveCount(0)
    expect(await api(owner.page, `/api/owner/courts/${c.id}/slots`)).toEqual([])
  } finally {
    await owner.context.close()
  }
})

test('UC-16 Player can reach real Last-Minute Deals through mobile and desktop navigation', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-deals-owner', true),
    player = await actor(browser, 'ux-deals-player')
  try {
    const c = await court(owner.page, 'Mobile deals')
    await api(owner.page, `/api/owner/courts/${c.id}/hours`, 'PUT', {
      windows: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opens_minute: 0,
        closes_minute: 1440,
      })),
    })
    const start = new Date(Date.now() + 8 * 3600000)
    start.setUTCMinutes(0, 0, 0)
    const s = await api<Slot>(
      owner.page,
      `/api/owner/courts/${c.id}/slots`,
      'POST',
      {
        start_at: start.toISOString(),
        end_at: new Date(+start + 3600000).toISOString(),
        price_vnd: 120000,
      }
    )
    await api(owner.page, `/api/owner/slots/${s.id}/offers`, 'POST', {
      mode: 'automatic',
      price_vnd: 90000,
      lead_hours: 24,
    })
    for (const width of [375, 768, 1280]) {
      await player.page.setViewportSize({ width, height: 900 })
      await player.page.goto('/')
      if (width < 1100)
        await player.page
          .getByRole('button', { name: 'Menu', exact: true })
          .click()
      await player.page
        .getByRole('link', { name: 'Ưu đãi giờ chót', exact: true })
        .click()
      await expect(player.page).toHaveURL(/\/deals$/)
      const card = player.page.locator('article').filter({
        has: player.page.getByRole('heading', { name: c.name, exact: true }),
      })
      await expect(card).toContainText('90.000')
      await card
        .getByRole('link', { name: 'Xem slot ưu đãi', exact: true })
        .click()
      await expect(player.page.locator('.slot-row')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(player.page.locator('.slot-row')).toContainText('90.000')
    }
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('UC-08 localized inline validation, photo preview and sport-correct broken-image fallback preserve form data', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-validation', true)
  try {
    await owner.page.goto('/owner/courts/new')
    await owner.page
      .getByRole('button', { name: 'Tạo sân và thiết lập lịch', exact: true })
      .click()
    await expect(
      owner.page.getByLabel('Tên sân', { exact: true })
    ).toBeFocused()
    await expect(
      owner.page.getByLabel('Tên sân', { exact: true })
    ).toHaveAttribute('aria-invalid', 'true')
    const fields = {
      'Tên sân': '   ',
      'Môn thể thao': 'Bóng đá',
      'Địa chỉ đầy đủ': '12 Đường số 8',
      'Khu vực': 'Thủ Đức',
      'Giá cơ bản / giờ (₫)': '120000',
      'Mô tả sân': 'Mô tả kiểm thử local',
    }
    for (const [label, value] of Object.entries(fields))
      await owner.page.getByLabel(label, { exact: true }).fill(value)
    await owner.page
      .getByRole('button', { name: 'Tạo sân và thiết lập lịch', exact: true })
      .click()
    await expect(
      owner.page.getByLabel('Tên sân', { exact: true })
    ).toHaveAttribute('aria-invalid', 'true')
    await expect(
      owner.page.getByText(
        'Vui lòng điền thông tin, không để trống hoặc chỉ nhập khoảng trắng.',
        { exact: true }
      )
    ).toBeVisible()
    await expect(
      owner.page.getByLabel('Mô tả sân', { exact: true })
    ).toHaveValue(fields['Mô tả sân'])
    await owner.page
      .getByLabel('Tên sân', { exact: true })
      .fill('Valid local preview')
    await owner.page
      .getByLabel('URL ảnh (mỗi dòng một URL)', { exact: true })
      .fill('javascript:alert(1)')
    await owner.page
      .getByRole('button', { name: 'Tạo sân và thiết lập lịch', exact: true })
      .click()
    await expect(
      owner.page.getByLabel('URL ảnh (mỗi dòng một URL)', { exact: true })
    ).toHaveAttribute('aria-invalid', 'true')
    await owner.page
      .getByLabel('URL ảnh (mỗi dòng một URL)', { exact: true })
      .fill(photo)
    const image = owner.page
      .getByRole('region', { name: 'Xem trước ảnh sân', exact: true })
      .getByRole('img', { name: 'Ảnh xem trước 1', exact: true })
    expect(
      await image.evaluate(async (el: HTMLImageElement) => {
        await el.decode()
        return el.naturalWidth
      })
    ).toBe(640)
    await owner.page
      .getByLabel('URL ảnh (mỗi dòng một URL)', { exact: true })
      .fill('http://localhost:5173/missing-fixture.jpg')
    await expect(
      owner.page
        .getByRole('region', { name: 'Xem trước ảnh sân', exact: true })
        .getByRole('img')
    ).toHaveAttribute('src', '/images/court-football.svg')
    await a11y(owner.page)
    await owner.page
      .getByRole('link', { name: 'Hủy, chưa lưu', exact: true })
      .click()
    await keep(owner.page)
    await expect(owner.page.getByLabel('Tên sân', { exact: true })).toHaveValue(
      'Valid local preview'
    )
    await owner.page
      .getByRole('link', { name: 'Hủy, chưa lưu', exact: true })
      .click()
    await discard(owner.page)
    expect(await api(owner.page, '/api/owner/courts')).toEqual([])
  } finally {
    await owner.context.close()
  }
})

test('UC-08 network failure keeps Owner edits and a real retry saves without an unsaved prompt', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-network', true)
  try {
    const c = await court(owner.page, 'Network')
    await owner.page.goto(`/owner/courts/${c.id}/edit`)
    const name = `${c.name} retry`
    await owner.page.getByLabel('Tên sân', { exact: true }).fill(name)
    await owner.page.route(`**/api/owner/courts/${c.id}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.abort('failed')
        : route.continue()
    )
    await owner.page
      .getByRole('button', { name: 'Lưu thông tin sân', exact: true })
      .click()
    await expect(owner.page.getByRole('alert')).toContainText(
      'Không thể kết nối'
    )
    await expect(owner.page.getByLabel('Tên sân', { exact: true })).toHaveValue(
      name
    )
    await owner.page.unroute(`**/api/owner/courts/${c.id}`)
    await owner.page
      .getByRole('button', { name: 'Lưu thông tin sân', exact: true })
      .click()
    await expect(owner.page).toHaveURL(/\/owner$/)
    await expect(owner.page.getByRole('dialog')).toHaveCount(0)
    await expect(
      owner.page.getByRole('heading', { name, exact: true })
    ).toBeVisible()
  } finally {
    await owner.context.close()
  }
})

test('UC-07/10 Keep cancellation and filtered Owner detail/back preserve the accepted booking', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-bookings-owner', true),
    player = await actor(browser, 'ux-bookings-player')
  try {
    const c = await court(owner.page, 'Filtered bookings')
    const booking = await book(player.page, [await slot(owner.page, c.id, 8)])
    const before = await api(player.page, `/api/bookings/${booking.id}`)
    await player.page.goto(`/bookings/${booking.id}`)
    await player.page
      .getByRole('button', { name: 'Hủy toàn bộ booking', exact: true })
      .click()
    await player.page
      .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
      .click()
    expect(await api(player.page, `/api/bookings/${booking.id}`)).toEqual(
      before
    )
    await owner.page.goto(
      `/owner/bookings?court=${c.id}&q=${encodeURIComponent(c.name)}&status=CONFIRMED&date=${day}`
    )
    await expect(owner.page.locator('.booking-card')).toHaveCount(1)
    const list = new URL(owner.page.url())
    await owner.page
      .getByRole('link', { name: 'Xem chi tiết', exact: true })
      .click()
    await expect(
      owner.page.getByText(player.email, { exact: true })
    ).toBeVisible()
    await a11y(owner.page)
    await owner.page
      .getByRole('link', { name: '← Danh sách booking', exact: true })
      .click()
    await expect(owner.page).toHaveURL(
      (url) =>
        url.pathname === list.pathname &&
        url.searchParams.size === list.searchParams.size &&
        [...list.searchParams].every(
          ([key, value]) => url.searchParams.get(key) === value
        )
    )
    await expect(
      owner.page.getByLabel('Mã booking hoặc tên sân', { exact: true })
    ).toHaveValue(c.name)
    await expect(
      owner.page.getByLabel('Trạng thái', { exact: true })
    ).toHaveValue('CONFIRMED')
    await expect(
      owner.page.getByLabel('Ngày chơi', { exact: true })
    ).toHaveValue(day)
    expect(await api(player.page, `/api/bookings/${booking.id}`)).toEqual(
      before
    )
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('UC-08 deactivation Keep/Confirm preserves existing accepted booking and blocks new discovery', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-deactivate-owner', true),
    player = await actor(browser, 'ux-deactivate-player')
  try {
    const c = await court(owner.page, 'Deactivate')
    const booking = await book(player.page, [await slot(owner.page, c.id, 8)])
    const before = await api(player.page, `/api/bookings/${booking.id}`)
    await owner.page.goto('/owner')
    await owner.page
      .getByRole('button', { name: 'Ngừng nhận booking mới', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
      .click()
    expect(
      (await api<{ active: boolean }>(owner.page, `/api/owner/courts/${c.id}`))
        .active
    ).toBe(true)
    await owner.page
      .getByRole('button', { name: 'Ngừng nhận booking mới', exact: true })
      .click()
    await a11y(owner.page)
    await owner.page
      .getByRole('button', { name: 'Xác nhận ngừng nhận', exact: true })
      .click()
    await expect(owner.page.locator('.badge-inactive')).toContainText(
      'Ngừng nhận mới'
    )
    expect(await api(player.page, `/api/bookings/${booking.id}`)).toEqual(
      before
    )
    await player.page.goto(`/?q=${encodeURIComponent(c.name)}`)
    await expect(
      player.page.getByRole('heading', {
        name: 'Không có sân phù hợp',
        exact: true,
      })
    ).toBeVisible()
    await expect(player.page.locator('.court-card')).toHaveCount(0)
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('UC-09 maintenance conflict/back retains the entered interval and a valid retry preserves confirmed booking', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-maintenance-owner', true),
    player = await actor(browser, 'ux-maintenance-player')
  try {
    const c = await court(owner.page, 'Maintenance')
    const booked = await slot(owner.page, c.id, 8)
    await slot(owner.page, c.id, 10)
    const booking = await book(player.page, [booked])
    const before = await api(player.page, `/api/bookings/${booking.id}`)
    await owner.page.goto(`/owner/schedule?court=${c.id}&date=${day}`)
    await owner.page
      .getByRole('button', { name: 'Thêm bảo trì', exact: true })
      .click()
    await owner.page
      .getByLabel('Bắt đầu bảo trì', { exact: true })
      .fill(`${day}T08:00`)
    await owner.page
      .getByLabel('Kết thúc bảo trì', { exact: true })
      .fill(`${day}T09:00`)
    await owner.page
      .getByRole('button', { name: 'Xem trước ảnh hưởng', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xác nhận bảo trì', exact: true })
      .click()
    await expect(
      owner.page.getByRole('dialog').getByRole('alert')
    ).toBeVisible()
    expect(
      await api(owner.page, `/api/owner/courts/${c.id}/maintenance`)
    ).toEqual([])
    await owner.page
      .getByRole('button', { name: 'Chỉnh khoảng thời gian', exact: true })
      .click()
    await expect(
      owner.page.getByLabel('Bắt đầu bảo trì', { exact: true })
    ).toHaveValue(`${day}T08:00`)
    await expect(
      owner.page.getByLabel('Kết thúc bảo trì', { exact: true })
    ).toHaveValue(`${day}T09:00`)
    await owner.page
      .getByLabel('Bắt đầu bảo trì', { exact: true })
      .fill(`${day}T10:00`)
    await owner.page
      .getByLabel('Kết thúc bảo trì', { exact: true })
      .fill(`${day}T11:00`)
    await owner.page
      .getByRole('button', { name: 'Xem trước ảnh hưởng', exact: true })
      .click()
    await a11y(owner.page)
    await owner.page
      .getByRole('button', { name: 'Xác nhận bảo trì', exact: true })
      .click()
    await expect(owner.page.locator('.calendar-row.maintenance')).toHaveCount(1)
    expect(await api(player.page, `/api/bookings/${booking.id}`)).toEqual(
      before
    )
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('UC-09 closed weekdays are disabled and batch preview/back retains generator settings and rows', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-hours', true)
  try {
    const c = await court(owner.page, 'Hours')
    await owner.page.goto(`/owner/schedule?court=${c.id}&date=${day}`)
    await owner.page
      .getByRole('button', { name: 'Giờ hoạt động', exact: true })
      .click()
    await owner.page.getByLabel('Mở cửa Thứ Hai', { exact: true }).fill('')
    await owner.page
      .getByRole('checkbox', { name: 'Thứ Hai', exact: true })
      .uncheck()
    await expect(
      owner.page.getByLabel('Mở cửa Thứ Hai', { exact: true })
    ).toBeDisabled()
    await expect(
      owner.page.getByLabel('Đóng cửa Thứ Hai', { exact: true })
    ).toBeDisabled()
    await owner.page
      .getByRole('button', { name: 'Lưu giờ hoạt động', exact: true })
      .click()
    await expect(owner.page.getByRole('dialog')).toHaveCount(0)
    const hours = await api<{ weekday: number }[]>(
      owner.page,
      `/api/owner/courts/${c.id}/hours`
    )
    expect(hours.some((row) => row.weekday === 0)).toBe(false)
    await owner.page
      .getByRole('button', { name: 'Tạo nhanh nhiều slot', exact: true })
      .click()
    await owner.page.getByLabel('Từ giờ', { exact: true }).fill('10:00')
    await owner.page.getByLabel('Đến giờ', { exact: true }).fill('16:00')
    await owner.page
      .getByLabel('Độ dài mỗi slot (phút)', { exact: true })
      .fill('120')
    await owner.page
      .getByLabel('Giá cả slot (₫)', { exact: true })
      .fill('155000')
    await owner.page
      .getByRole('button', { name: 'Tạo / thay danh sách nháp', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xem trước toàn bộ', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Quay lại chỉnh nháp', exact: true })
      .click()
    await expect(owner.page.getByLabel('Từ giờ', { exact: true })).toHaveValue(
      '10:00'
    )
    await expect(owner.page.getByLabel('Đến giờ', { exact: true })).toHaveValue(
      '16:00'
    )
    await expect(
      owner.page.getByLabel('Độ dài mỗi slot (phút)', { exact: true })
    ).toHaveValue('120')
    await expect(
      owner.page.getByLabel('Giá dòng 1', { exact: true })
    ).toHaveValue('155000')
    expect(await api(owner.page, `/api/owner/courts/${c.id}/slots`)).toEqual([])
  } finally {
    await owner.context.close()
  }
})

test('UC-05 injected network error retains review and selection; retry uses the real API', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-player-network-owner', true),
    player = await actor(browser, 'ux-player-network-player')
  try {
    const c = await court(owner.page, 'Player retry')
    await slot(owner.page, c.id, 8)
    await player.page.goto(`/courts/${c.id}/slots?date=${day}`)
    await player.page.locator('.slot-row').click()
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(player.page.getByRole('dialog')).toBeVisible()
    await player.page.route('**/api/bookings', (route) =>
      route.request().method() === 'POST'
        ? route.abort('failed')
        : route.continue()
    )
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(
      player.page.getByRole('dialog').getByRole('alert')
    ).toContainText('Không thể kết nối')
    await expect(
      player.page.locator('.slot-row[aria-pressed="true"]')
    ).toHaveCount(1)
    expect(await api(player.page, '/api/bookings')).toEqual([])
    await player.page.unroute('**/api/bookings')
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/bookings\/[a-f0-9-]+$/)
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('UC-03 delayed real loading, injected error and retry to a real empty result preserve search', async ({
  page,
}) => {
  await page.route('**/api/courts?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.continue()
  })
  await page.goto('/?q=nonexistent-ux-' + Date.now())
  await expect(page.getByText('Đang tải sân…', { exact: true })).toBeVisible()
  await expect(page.getByText('Đang tải sân…', { exact: true })).toHaveCount(0)
  await page.unroute('**/api/courts?**')
  const name = await page.getByLabel('Tên sân', { exact: true }).inputValue()
  await page.route('**/api/courts?**', (route) => route.abort('failed'))
  await page.getByRole('button', { name: 'Tìm sân', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối')
  await page.unroute('**/api/courts?**')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Không có sân phù hợp', exact: true })
  ).toBeVisible()
  await expect(page.locator('.court-card')).toHaveCount(0)
  await expect(page.getByLabel('Tên sân', { exact: true })).toHaveValue(name)
})

test('UC-08 navigation while saving is blocked and successful save clears the pending discard dialog', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-saving', true)
  try {
    const c = await court(owner.page, 'Saving')
    await owner.page.goto(`/owner/courts/${c.id}/edit`)
    await owner.page
      .getByLabel('Tên sân', { exact: true })
      .fill(`${c.name} saved`)
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await owner.page.route(`**/api/owner/courts/${c.id}`, async (route) => {
      if (route.request().method() === 'PATCH') await gate
      await route.continue()
    })
    await owner.page
      .getByRole('button', { name: 'Lưu thông tin sân', exact: true })
      .click()
    await expect(
      owner.page.getByRole('button', { name: 'Đang lưu…', exact: true })
    ).toBeDisabled()
    await owner.page.setViewportSize({ width: 1280, height: 900 })
    await owner.page
      .getByRole('navigation', { name: 'Điều hướng chính', exact: true })
      .getByRole('link', { name: 'Lịch sân', exact: true })
      .click()
    const dialog = owner.page.getByRole('dialog', {
      name: 'Bỏ thay đổi chưa lưu?',
      exact: true,
    })
    await expect(dialog).toContainText('Đang lưu dữ liệu')
    await expect(
      dialog.getByRole('button', { name: 'Đang lưu…', exact: true })
    ).toBeDisabled()
    await owner.page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await owner.page
      .getByRole('navigation', { name: 'Điều hướng chính', exact: true })
      .getByRole('link', { name: 'Lịch sân', exact: true })
      .click()
    await expect(dialog).toBeVisible()
    release()
    await expect(owner.page).toHaveURL(/\/owner$/)
    await expect(dialog).toHaveCount(0)
    await expect(
      owner.page.getByRole('heading', { name: `${c.name} saved`, exact: true })
    ).toBeVisible()
  } finally {
    await owner.context.close()
  }
})

test('UC-09 rejected overlapping batch retains every draft and correction publishes the whole batch once', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-batch-conflict', true)
  try {
    const c = await court(owner.page, 'Batch correction')
    await owner.page.goto(`/owner/schedule?court=${c.id}&date=${day}`)
    await owner.page
      .getByRole('button', { name: 'Tạo nhanh nhiều slot', exact: true })
      .click()
    await owner.page.getByLabel('Đến giờ', { exact: true }).fill('08:00')
    await owner.page
      .getByRole('button', { name: 'Tạo / thay danh sách nháp', exact: true })
      .click()
    await owner.page
      .getByLabel('Bắt đầu dòng 2', { exact: true })
      .fill(`${day}T06:30`)
    await owner.page
      .getByLabel('Kết thúc dòng 2', { exact: true })
      .fill(`${day}T07:30`)
    await owner.page
      .getByRole('button', { name: 'Xem trước toàn bộ', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xác nhận công bố 2 slot', exact: true })
      .click()
    await expect(owner.page.getByRole('alert')).toContainText(
      'Các dòng nháp bị trùng giờ'
    )
    expect(await api(owner.page, `/api/owner/courts/${c.id}/slots`)).toEqual([])
    await owner.page
      .getByRole('button', { name: 'Quay lại chỉnh nháp', exact: true })
      .click()
    await expect(
      owner.page.getByLabel('Bắt đầu dòng 2', { exact: true })
    ).toHaveValue(`${day}T06:30`)
    await owner.page
      .getByLabel('Bắt đầu dòng 2', { exact: true })
      .fill(`${day}T07:00`)
    await owner.page
      .getByLabel('Kết thúc dòng 2', { exact: true })
      .fill(`${day}T08:00`)
    await owner.page
      .getByRole('button', { name: 'Xem trước toàn bộ', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xác nhận công bố 2 slot', exact: true })
      .click()
    await expect(owner.page.locator('.calendar-row.slot')).toHaveCount(2)
    await expect(owner.page.getByRole('dialog')).toHaveCount(0)
    expect(
      await api<Slot[]>(owner.page, `/api/owner/courts/${c.id}/slots`)
    ).toHaveLength(2)
  } finally {
    await owner.context.close()
  }
})

test('UC-11/12/13 guest room browsing, create Cancel and join Keep leave source data unchanged', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-public-owner', true),
    organizer = await actor(browser, 'ux-public-organizer'),
    member = await actor(browser, 'ux-public-member')
  const guest = await browser.newContext({ baseURL: 'http://localhost:5173' })
  try {
    const c = await court(owner.page, 'Public room')
    const area = `Guest-${c.id}`
    await api(owner.page, `/api/owner/courts/${c.id}`, 'PATCH', { area })
    const booking = await book(organizer.page, [
      await slot(owner.page, c.id, 8),
    ])
    await organizer.page.goto(`/bookings/${booking.id}`)
    await organizer.page
      .getByRole('button', { name: 'Tạo phòng Open Play', exact: true })
      .click()
    await organizer.page.getByLabel('Sức chứa phòng', { exact: true }).fill('1')
    await organizer.page
      .getByRole('button', { name: 'Tạo phòng', exact: true })
      .click()
    await expect(
      organizer.page.getByLabel('Sức chứa phòng', { exact: true })
    ).toHaveAttribute('aria-invalid', 'true')
    await organizer.page.getByLabel('Sức chứa phòng', { exact: true }).fill('4')
    await organizer.page.keyboard.press('Escape')
    expect(
      (await api<Booking>(organizer.page, `/api/bookings/${booking.id}`))
        .room_id
    ).toBeNull()
    await organizer.page
      .getByRole('button', { name: 'Tạo phòng Open Play', exact: true })
      .click()
    await organizer.page.getByLabel('Sức chứa phòng', { exact: true }).fill('4')
    await organizer.page
      .getByRole('button', { name: 'Tạo phòng', exact: true })
      .click()
    await expect(organizer.page).toHaveURL(/\/rooms\/[a-f0-9-]+$/)
    const path = new URL(organizer.page.url()).pathname
    const before = await api(organizer.page, `/api${path}/membership`)
    const page = await guest.newPage()
    await page.goto(`/rooms?location=${area}`)
    await page.getByRole('link', { name: 'Xem phòng', exact: true }).click()
    await expect(
      page.getByRole('link', { name: 'Đăng nhập để tham gia', exact: true })
    ).toBeVisible()
    await expect(page.locator('.member-list')).not.toContainText(
      organizer.email
    )
    await page
      .getByRole('link', { name: '← Danh sách phòng', exact: true })
      .click()
    await expect(
      page.getByLabel('Địa chỉ hoặc khu vực', { exact: true })
    ).toHaveValue(area)
    await member.page.goto(path)
    await member.page
      .getByRole('button', { name: 'Tham gia phòng', exact: true })
      .click()
    await member.page
      .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
      .click()
    expect(await api(organizer.page, `/api${path}/membership`)).toEqual(before)
    await member.page
      .getByRole('button', { name: 'Tham gia phòng', exact: true })
      .click()
    await member.page
      .getByRole('button', { name: 'Xác nhận tham gia', exact: true })
      .click()
    await expect(
      member.page.getByText('2 / 4 thành viên', { exact: true })
    ).toBeVisible()
    await a11y(member.page)
  } finally {
    await owner.context.close()
    await organizer.context.close()
    await member.context.close()
    await guest.close()
  }
})

test('UC-09 finishing a modal save clears a browser Back blocker without a stale discard prompt', async ({
  browser,
}) => {
  const owner = await actor(browser, 'ux-modal-saving', true)
  try {
    const c = await court(owner.page, 'Modal save')
    await owner.page.goto('/owner')
    await owner.page
      .getByRole('link', { name: 'Lịch sân', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Giờ hoạt động', exact: true })
      .click()
    await owner.page.getByLabel('Mở cửa Thứ Hai', { exact: true }).fill('06:30')
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await owner.page.route(
      `**/api/owner/courts/${c.id}/hours`,
      async (route) => {
        if (route.request().method() === 'PUT') await gate
        await route.continue()
      }
    )
    await owner.page
      .getByRole('button', { name: 'Lưu giờ hoạt động', exact: true })
      .click()
    await owner.page.evaluate(() => history.back())
    await expect(
      owner.page.getByRole('dialog', {
        name: 'Bỏ thay đổi chưa lưu?',
        exact: true,
      })
    ).toBeVisible()
    release()
    await expect(
      owner.page.getByRole('dialog', {
        name: 'Giờ hoạt động của sân',
        exact: true,
      })
    ).toHaveCount(0)
    await expect(
      owner.page.getByRole('dialog', {
        name: 'Bỏ thay đổi chưa lưu?',
        exact: true,
      })
    ).toHaveCount(0)
    const hours = await api<{ weekday: number; opens_minute: number }[]>(
      owner.page,
      `/api/owner/courts/${c.id}/hours`
    )
    expect(hours.find((h) => h.weekday === 0)?.opens_minute).toBe(390)
  } finally {
    await owner.context.close()
  }
})
