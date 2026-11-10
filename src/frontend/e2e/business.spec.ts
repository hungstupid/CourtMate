import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { localDay } from '../src/lib/format'

const marker = process.env.COURTMATE_E2E_MARKER!
const day = localDay(new Date(Date.now() + 2 * 86400000))
async function register(browser: Browser, suffix: string, owner = false) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5173' })
  const page = await context.newPage()
  const email = `${marker}-${suffix}@courtmate.test`
  await page.goto('/register')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Isolated-browser-123!')
  if (owner) await page.getByRole('radio', { name: /Chủ sân/ }).check()
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page).toHaveURL(owner ? /\/owner$/ : /\/$/)
  return { context, page, email }
}
async function createCourt(page: Page, name: string) {
  await page.goto('/owner/courts/new')
  for (const [label, value] of Object.entries({
    'Tên sân': name,
    'Môn thể thao': 'Cầu lông',
    'Địa chỉ đầy đủ': '12 Đường số 8, Thủ Đức',
    'Khu vực': 'Thủ Đức',
    'Giá cơ bản / giờ (₫)': '120000',
    'Mô tả sân': 'Dữ liệu test local; không phải sân thực tế.',
  }))
    await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByRole('button', { name: 'Tạo sân và thiết lập lịch' }).click()
  await expect(page).toHaveURL(/\/owner\/schedule\?court=/)
  const courtId = new URL(page.url()).searchParams.get('court')!
  await page.getByRole('button', { name: 'Giờ hoạt động', exact: true }).click()
  for (const name of [
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
    'Chủ Nhật',
  ]) {
    await page.getByRole('checkbox', { name, exact: true }).check()
    await page.getByLabel(`Mở cửa ${name}`, { exact: true }).fill('00:00')
    await page.getByLabel(`Đóng cửa ${name}`, { exact: true }).fill('24:00')
  }
  await page.getByRole('button', { name: 'Lưu giờ hoạt động' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  return courtId
}
async function publish(page: Page) {
  await page.getByLabel('Ngày xem lịch', { exact: true }).fill(day)
  await page
    .getByRole('button', { name: 'Tạo nhanh nhiều slot', exact: true })
    .click()
  await page.getByRole('button', { name: 'Tạo / thay danh sách nháp' }).click()
  await expect(page.getByRole('heading', { name: '8 slot nháp' })).toBeVisible()
  await page
    .getByRole('button', { name: '+ Thêm dòng nháp', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: '9 slot nháp' })).toBeVisible()
  await page.getByLabel('Giá dòng 9', { exact: true }).fill('125000')
  await page.getByRole('button', { name: 'Xóa dòng 9', exact: true }).click()
  await page.getByRole('button', { name: 'Xem trước toàn bộ' }).click()
  await expect(page.locator('.calendar-row.slot')).toHaveCount(0)
  await page.getByRole('button', { name: 'Xác nhận công bố 8 slot' }).click()
  await expect(
    page.getByRole('heading', { name: 'Xem trước khi công bố' })
  ).toHaveCount(0)
  await expect(page.locator('.calendar-row.slot')).toHaveCount(8)
}

test('real Owner → discovery → multi-slot booking → Open Play → close → cancellation', async ({
  browser,
}) => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Business writes use only the guarded local test DB.'
  )
  test.setTimeout(180000)
  const owner = await register(browser, 'owner', true)
  const player = await register(browser, 'player')
  const member = await register(browser, 'member')
  try {
    const name = `${marker} Court`
    const court = await createCourt(owner.page, name)
    await publish(owner.page)
    for (const width of [375, 768, 1280]) {
      await owner.page.setViewportSize({ width, height: 900 })
      expect(
        await owner.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await owner.page.screenshot({
        path: `/tmp/courtmate-owner-${width}.png`,
        fullPage: true,
      })
      const result = await new AxeBuilder({ page: owner.page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(result.violations).toEqual([])
    }
    await player.page.goto('/')
    for (const [label, value] of Object.entries({
      'Tên sân': name,
      'Địa chỉ hoặc khu vực': 'thủ đức',
      'Bắt đầu · tùy chọn': `${day}T06:00`,
      'Kết thúc · tùy chọn': `${day}T14:00`,
    }))
      await player.page.getByLabel(label, { exact: true }).fill(value)
    await player.page
      .getByRole('button', { name: 'Tìm sân', exact: true })
      .click()
    await expect(player.page.locator('.court-card')).toHaveCount(1)
    await player.page
      .getByRole('button', { name: 'Xem slot ↗', exact: true })
      .click()
    await expect(
      player.page.getByRole('dialog').locator('.slot-preview-row')
    ).toHaveCount(8)
    await player.page.keyboard.press('Escape')
    await expect(
      player.page.getByRole('button', { name: 'Xem slot ↗', exact: true })
    ).toBeFocused()
    await expect(
      player.page.getByLabel('Tên sân', { exact: true })
    ).toHaveValue(name)
    await player.page
      .getByRole('button', { name: 'Xem slot ↗', exact: true })
      .click()
    await player.page
      .getByRole('dialog')
      .locator('.slot-preview-row')
      .first()
      .click()
    await player.page.getByRole('button', { name: /07:00–08:00/ }).click()
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(player.page.getByRole('dialog')).toContainText('120 phút')
    await expect(
      player.page.getByRole('dialog').locator('.review-slots > div')
    ).toHaveCount(2)
    for (const width of [375, 768, 1280]) {
      await player.page.setViewportSize({ width, height: 900 })
      expect(
        await player.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await player.page.screenshot({
        path: `/tmp/courtmate-review-${width}.png`,
        fullPage: false,
      })
      const result = await new AxeBuilder({ page: player.page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(result.violations).toEqual([])
    }
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(
      player.page.getByRole('heading', {
        name: 'Đặt sân thành công',
        exact: true,
      })
    ).toBeVisible()
    const bookingUrl = player.page.url()
    const bookingId = bookingUrl.split('/').at(-1)!
    await player.page
      .getByRole('button', { name: 'Tạo phòng Open Play', exact: true })
      .click()
    await player.page.getByLabel('Sức chứa phòng', { exact: true }).fill('16')
    await player.page
      .getByRole('button', { name: 'Tạo phòng', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/rooms\/[a-f0-9-]+$/)
    const roomUrl = player.page.url()
    await member.page.goto(roomUrl)
    const join = async () => {
      await member.page
        .getByRole('button', { name: 'Tham gia phòng', exact: true })
        .click()
      await member.page
        .getByRole('button', { name: 'Xác nhận tham gia', exact: true })
        .click()
      await expect(
        member.page.getByText('2 / 16 thành viên', { exact: true })
      ).toBeVisible()
    }
    await join()
    await member.page
      .getByRole('button', { name: 'Rời phòng', exact: true })
      .click()
    await member.page
      .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
      .click()
    await expect(
      member.page.getByText('2 / 16 thành viên', { exact: true })
    ).toBeVisible()
    await member.page
      .getByRole('button', { name: 'Rời phòng', exact: true })
      .click()
    await member.page
      .getByRole('button', { name: 'Xác nhận rời phòng', exact: true })
      .click()
    await expect(
      member.page.getByText('1 / 16 thành viên', { exact: true })
    ).toBeVisible()
    await join()
    await player.page.reload()
    await player.page
      .getByRole('button', { name: 'Đóng phòng', exact: true })
      .click()
    await player.page
      .getByRole('button', { name: 'Xác nhận đóng phòng', exact: true })
      .click()
    await expect(
      player.page.getByRole('button', { name: 'Đóng phòng', exact: true })
    ).toBeDisabled()
    await expect(
      player.page.getByText('2 / 16 thành viên', { exact: true })
    ).toBeVisible()
    await member.page.reload()
    await expect(
      member.page.getByRole('button', { name: 'Rời phòng', exact: true })
    ).toBeDisabled()
    await owner.page.goto(`/owner/bookings/${bookingId}`)
    await expect(
      owner.page.getByText(player.email, { exact: true })
    ).toBeVisible()
    await expect(owner.page.locator('.badge-confirmed')).toContainText(
      'CONFIRMED'
    )
    await player.page.goto(bookingUrl)
    await expect(player.page.locator('.badge-confirmed')).toContainText(
      'CONFIRMED'
    )
    await player.page
      .getByRole('button', { name: 'Hủy toàn bộ booking', exact: true })
      .click()
    await player.page
      .getByRole('button', { name: 'Xác nhận hủy booking', exact: true })
      .click()
    await expect(player.page.locator('.badge-cancelled')).toContainText(
      'CANCELLED'
    )
    await player.page.goto(`/courts/${court}/slots?date=${day}`)
    await expect(player.page.locator('.slot-row')).toHaveCount(8)
    await expect(player.page.locator('.slot-row:disabled')).toHaveCount(0)
  } finally {
    await owner.context.close()
    await player.context.close()
    await member.context.close()
  }
})

test('Owner automatic-offer confirmation, cancellation, profile and maintenance', async ({
  browser,
}) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'Isolated local writes only.')
  test.setTimeout(120000)
  const owner = await register(browser, 'offers-owner', true)
  try {
    const court = await createCourt(owner.page, `${marker} Offers`)
    await publish(owner.page)
    await owner.page
      .locator('.calendar-row.slot')
      .first()
      .getByRole('link', { name: 'Ưu đãi', exact: true })
      .click()
    await owner.page
      .getByLabel('Giá ưu đãi cho cả slot (₫)', { exact: true })
      .fill('90000')
    await owner.page
      .getByLabel('Tự áp trước giờ chơi (giờ)', { exact: true })
      .fill('0.5')
    await owner.page
      .getByRole('button', { name: 'Xem lại lịch tự động', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Lưu lịch tự động', exact: true })
      .click()
    await expect(owner.page.locator('.offer-record')).toContainText('SCHEDULED')
    await owner.page
      .getByRole('button', { name: 'Hủy lịch ưu đãi', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
      .click()
    await expect(owner.page.locator('.offer-record')).toContainText('SCHEDULED')
    await owner.page
      .getByRole('button', { name: 'Hủy lịch ưu đãi', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xác nhận hủy lịch', exact: true })
      .click()
    await expect(owner.page.locator('.offer-record')).toContainText('CANCELLED')
    await owner.page.goto('/profile')
    await owner.page
      .getByLabel('Tên hiển thị', { exact: true })
      .fill('CourtMate Owner')
    await owner.page
      .getByLabel('Tùy chọn liên hệ', { exact: true })
      .fill('Email only')
    await owner.page
      .getByRole('button', { name: 'Lưu hồ sơ', exact: true })
      .click()
    await expect(owner.page.getByRole('status')).toContainText('Hồ sơ đã lưu')
    await owner.page.reload()
    await expect(
      owner.page.getByLabel('Tên hiển thị', { exact: true })
    ).toHaveValue('CourtMate Owner')
    await owner.page.goto(`/owner/schedule?court=${court}&date=${day}`)
    await owner.page
      .getByRole('button', { name: 'Thêm bảo trì', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xem trước ảnh hưởng', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xác nhận bảo trì', exact: true })
      .click()
    await expect(owner.page.locator('.calendar-row.maintenance')).toHaveCount(1)
    await expect(
      owner.page.locator('.calendar-row.slot .badge-blocked')
    ).toHaveCount(2)
  } finally {
    await owner.context.close()
  }
})

for (const width of [375, 768, 1280])
  test(`responsive discovery and dropdown keyboard ${width}px @a11y`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByText('Đang tải sân…', { exact: true })).toHaveCount(
      0
    )
    await expect(
      page.getByRole('heading', { name: 'Khám phá sân chơi' })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    const sport = page.getByRole('button', { name: /Môn thể thao/ })
    await sport.click()
    await expect(
      page.getByRole('textbox', { name: 'Tìm môn theo tiền tố', exact: true })
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(sport).toBeFocused()
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(result.violations).toEqual([])
    await page.goto('/rooms')
    await expect(
      page.getByRole('heading', { name: 'Tìm một trận gần bạn' })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })

test('clearing time preserves unsubmitted name/location and invalid time stays inline', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Tên sân', { exact: true }).fill('draft name')
  await page.getByLabel('Địa chỉ hoặc khu vực', { exact: true }).fill('Thủ Đức')
  await page
    .getByLabel('Bắt đầu · tùy chọn', { exact: true })
    .fill(`${day}T06:00`)
  await page
    .getByRole('button', { name: 'Chỉ xóa thời gian', exact: true })
    .click()
  await expect(page.getByLabel('Tên sân', { exact: true })).toHaveValue(
    'draft name'
  )
  await expect(
    page.getByLabel('Địa chỉ hoặc khu vực', { exact: true })
  ).toHaveValue('Thủ Đức')
  await expect(
    page.getByLabel('Bắt đầu · tùy chọn', { exact: true })
  ).toHaveValue('')
  await page
    .getByLabel('Bắt đầu · tùy chọn', { exact: true })
    .fill(`${day}T20:00`)
  await page
    .getByLabel('Kết thúc · tùy chọn', { exact: true })
    .fill(`${day}T18:00`)
  await page.getByRole('button', { name: 'Tìm sân', exact: true }).click()
  await expect(
    page.getByText('Thời điểm kết thúc phải sau bắt đầu.', { exact: true })
  ).toBeVisible()
  await expect(page.getByLabel('Tên sân', { exact: true })).toHaveValue(
    'draft name'
  )
})
