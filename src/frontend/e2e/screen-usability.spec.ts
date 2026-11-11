import { expect, test } from '@playwright/test'
import { actor, api, book, court, day, password, slot } from './review-fixtures'
import type { Profile, Room, Slot } from '../src/lib/types'

test.beforeEach(() =>
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Guarded local database/demo emulator only.'
  )
)

test('profile save cannot silently accept edits made after its request snapshot', async ({
  browser,
}) => {
  const player = await actor(browser, 'screen-profile')
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await player.page.goto('/profile')
    const field = player.page.getByLabel('Tên hiển thị', { exact: true })
    await field.fill('Đã gửi để lưu')
    await player.page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'PATCH') await pending
      await route.continue()
    })
    await player.page
      .getByRole('button', { name: 'Lưu hồ sơ', exact: true })
      .click()
    await expect(
      player.page.getByRole('button', { name: 'Đang lưu…', exact: true })
    ).toBeDisabled()
    // Exercise the old data-loss path before asserting the saved UI matches
    // PostgreSQL. A busy form must prevent these unsent edits.
    if (await field.isEnabled()) await field.fill('Thay đổi chưa được gửi')
    release()
    await expect(player.page.getByRole('status')).toContainText('Hồ sơ đã lưu')
    const saved = await api<Profile>(player.page, '/api/profile')
    await expect(field).toHaveValue(saved.display_name)
    await field.fill('Bản nháp tiếp theo')
    await expect(
      player.page.getByText('Hồ sơ đã lưu thành công.', { exact: true })
    ).toHaveCount(0)
  } finally {
    release()
    await player.context.close()
  }
})

test('room creation network failure retains capacity across readback and retry', async ({
  browser,
}) => {
  const owner = await actor(browser, 'screen-room-owner', true)
  const player = await actor(browser, 'screen-room-player')
  try {
    const c = await court(owner.page, 'Room retry')
    const booking = await book(player.page, [await slot(owner.page, c.id, 8)])
    await player.page.goto(`/bookings/${booking.id}`)
    await player.page
      .getByRole('button', { name: 'Tạo phòng Open Play', exact: true })
      .click()
    const capacity = player.page.getByLabel('Sức chứa phòng', { exact: true })
    await capacity.fill('12')
    await player.page.route(
      `**/api/bookings/${booking.id}/room`,
      (route) => route.abort('failed'),
      { times: 1 }
    )
    await player.page
      .getByRole('button', { name: 'Tạo phòng', exact: true })
      .click()
    await expect(player.page.getByRole('alert')).toBeVisible()
    await expect(capacity).toHaveValue('12')
    await player.page
      .getByRole('button', { name: 'Tạo phòng', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/rooms\//)
    await expect(
      player.page.getByText('1 / 12 thành viên', { exact: true })
    ).toBeVisible()
    await player.page.reload()
    await expect(
      player.page.getByText('1 / 12 thành viên', { exact: true })
    ).toBeVisible()
    const id = player.page.url().split('/').at(-1)!
    expect(
      (await api<Room>(player.page, `/api/rooms/${id}/membership`)).capacity
    ).toBe(12)
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('lost room-creation response recovers the committed room instead of offering a duplicate retry', async ({
  browser,
}) => {
  const owner = await actor(browser, 'screen-room-commit-owner', true)
  const player = await actor(browser, 'screen-room-commit-player')
  try {
    const c = await court(owner.page, 'Committed room')
    const booking = await book(player.page, [await slot(owner.page, c.id, 8)])
    await player.page.goto(`/bookings/${booking.id}`)
    await player.page
      .getByRole('button', { name: 'Tạo phòng Open Play', exact: true })
      .click()
    await player.page.getByLabel('Sức chứa phòng', { exact: true }).fill('12')
    await player.page.route(
      `**/api/bookings/${booking.id}/room`,
      async (route) => {
        const response = await route.fetch()
        expect([200, 201]).toContain(response.status())
        await route.abort('failed')
      },
      { times: 1 }
    )
    await player.page
      .getByRole('button', { name: 'Tạo phòng', exact: true })
      .click()
    const recovered = player.page.getByRole('dialog', {
      name: 'Phòng Open Play đã có',
      exact: true,
    })
    await expect(recovered).toBeVisible()
    await expect(
      recovered.getByRole('button', { name: 'Tạo phòng', exact: true })
    ).toHaveCount(0)
    await recovered
      .getByRole('link', { name: 'Mở phòng Open Play', exact: true })
      .click()
    await expect(
      player.page.getByText('1 / 12 thành viên', { exact: true })
    ).toBeVisible()
    const rooms = await api<Room[]>(
      player.page,
      `/api/rooms?location=${encodeURIComponent(c.area)}`
    )
    expect(rooms.filter((room) => room.court_id === c.id)).toHaveLength(1)
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('clicking dialog padding keeps its contents; actual backdrop and Escape dismiss safely', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Menu', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', {
    name: 'Menu CourtMate',
    exact: true,
  })
  const bounds = (await dialog.boundingBox())!
  await page.mouse.click(bounds.x + 3, bounds.y + bounds.height / 2)
  await expect(dialog).toBeVisible()
  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

for (const form of ['court', 'hours', 'slot'] as const)
  test(`Owner ${form} editor freezes the submitted fields until a real save completes`, async ({
    browser,
  }) => {
    const owner = await actor(browser, `screen-busy-${form}`, true)
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    try {
      const c = await court(owner.page, `Busy ${form}`)
      const s = await slot(owner.page, c.id, 8)
      await owner.page.goto(
        form === 'court'
          ? `/owner/courts/${c.id}/edit`
          : `/owner/schedule?court=${c.id}&date=${day}`
      )
      if (form === 'hours')
        await owner.page
          .getByRole('button', { name: 'Giờ hoạt động', exact: true })
          .click()
      if (form === 'slot')
        await owner.page
          .locator('.calendar-row.slot')
          .getByRole('button', { name: 'Sửa', exact: true })
          .click()
      const label =
        form === 'court'
          ? 'Tên sân'
          : form === 'hours'
            ? 'Mở cửa Thứ Hai'
            : 'Giá cả slot (₫)'
      const field = owner.page.getByLabel(label, { exact: true })
      await field.fill(
        form === 'court'
          ? `${c.name} Saved`
          : form === 'hours'
            ? '07:00'
            : '135000'
      )
      const path =
        form === 'court'
          ? `/api/owner/courts/${c.id}`
          : form === 'hours'
            ? `/api/owner/courts/${c.id}/hours`
            : `/api/owner/slots/${s.id}`
      await owner.page.route(`**${path}`, async (route) => {
        if (['PUT', 'PATCH'].includes(route.request().method())) await pending
        await route.continue()
      })
      await owner.page
        .getByRole('button', {
          name:
            form === 'court'
              ? 'Lưu thông tin sân'
              : form === 'hours'
                ? 'Lưu giờ hoạt động'
                : 'Lưu slot',
          exact: true,
        })
        .click()
      await expect(
        owner.page.getByRole('button', { name: 'Đang lưu…', exact: true })
      ).toBeDisabled()
      await expect(field).toBeDisabled()
      release()
      if (form === 'court') await expect(owner.page).toHaveURL(/\/owner$/)
      else await expect(owner.page.getByRole('dialog')).toHaveCount(0)
      const saved = await api<
        Record<string, unknown> | { opens_minute: number }[]
      >(
        owner.page,
        form === 'slot' ? `/api/owner/courts/${c.id}/slots?date=${day}` : path
      )
      if (form === 'court')
        expect(saved).toMatchObject({ name: `${c.name} Saved` })
      if (form === 'hours')
        expect(saved).toContainEqual(
          expect.objectContaining({ weekday: 0, opens_minute: 420 })
        )
      if (form === 'slot')
        expect(saved).toContainEqual(
          expect.objectContaining({ id: s.id, price_vnd: 135000 })
        )
    } finally {
      release()
      await owner.context.close()
    }
  })

test('registration locks email/password/initial role while Firebase signup is pending', async ({
  browser,
}) => {
  const player = await actor(browser, 'screen-busy-auth')
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await player.page.goto('/profile')
    await player.page
      .getByRole('button', { name: 'Đăng xuất', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/login$/)
    await player.page.goto('/register')
    await player.page
      .getByLabel('Email', { exact: true })
      .fill(player.email.replace('@', '-signup@'))
    await player.page.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await player.page.route('**/*accounts:signUp*', async (route) => {
      await pending
      await route.continue()
    })
    await player.page
      .getByRole('button', { name: 'Tạo tài khoản', exact: true })
      .click()
    await expect(
      player.page.getByRole('button', { name: 'Đang kết nối…', exact: true })
    ).toBeDisabled()
    for (const label of ['Email', 'Mật khẩu'])
      await expect(
        player.page.getByLabel(label, { exact: true })
      ).toBeDisabled()
    await expect(
      player.page.getByRole('radio', { name: /Chủ sân/ })
    ).toBeDisabled()
    release()
    await expect(player.page).toHaveURL(/\/$/)
    expect(await api(player.page, '/api/me')).toMatchObject({ role: 'player' })
  } finally {
    release()
    await player.context.close()
  }
})

test('midnight slots show 24:00 consistently in Owner calendar, Player selection, review and accepted booking', async ({
  browser,
}) => {
  const owner = await actor(browser, 'screen-midnight-owner', true)
  const player = await actor(browser, 'screen-midnight-player')
  try {
    const c = await court(owner.page, 'Midnight')
    await api(owner.page, `/api/owner/courts/${c.id}/hours`, 'PUT', {
      windows: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opens_minute: 0,
        closes_minute: 1440,
      })),
    })
    const start = new Date(`${day}T23:00:00+07:00`)
    await api<Slot>(owner.page, `/api/owner/courts/${c.id}/slots`, 'POST', {
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + 3600000).toISOString(),
      price_vnd: 120000,
    })
    await owner.page.goto(`/owner/schedule?court=${c.id}&date=${day}`)
    await expect(owner.page.locator('.calendar-row.slot')).toHaveCount(1)
    await expect(owner.page.locator('.calendar-row.slot strong')).toHaveText(
      '23:00–24:00'
    )
    await player.page.goto(`/courts/${c.id}/slots?date=${day}`)
    await player.page.getByRole('button', { name: /23:00–24:00/ }).click()
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(player.page.getByRole('dialog')).toContainText('23:00–24:00')
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(
      player.page.getByRole('heading', {
        name: 'Đặt sân thành công',
        exact: true,
      })
    ).toBeVisible()
    await expect(player.page.locator('.booking-details')).toContainText(
      '23:00–24:00'
    )
    await player.page.reload()
    await expect(player.page.locator('.booking-details')).toContainText(
      '23:00–24:00'
    )
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('multi-day maintenance shows its actual end date in preview and saved calendar', async ({
  browser,
}) => {
  const owner = await actor(browser, 'screen-maintenance-dates', true)
  try {
    const c = await court(owner.page, 'Maintenance dates')
    const start = `${day}T08:00`
    const endInstant = new Date(
      new Date(`${start}:00+07:00`).getTime() + 40 * 3600000
    )
    const endDay = new Date(endInstant.getTime() + 7 * 3600000)
      .toISOString()
      .slice(0, 10)
    const [year, month, date] = endDay.split('-')
    const visibleEnd = `${Number(date)}/${month}/${year} · 00:00`
    await owner.page.goto(`/owner/schedule?court=${c.id}&date=${day}`)
    await owner.page
      .getByRole('button', { name: 'Thêm bảo trì', exact: true })
      .click()
    await owner.page.getByLabel('Bắt đầu bảo trì', { exact: true }).fill(start)
    await owner.page
      .getByLabel('Kết thúc bảo trì', { exact: true })
      .fill(`${endDay}T00:00`)
    await owner.page
      .getByRole('button', { name: 'Xem trước ảnh hưởng', exact: true })
      .click()
    await expect(owner.page.getByRole('dialog')).toContainText(visibleEnd)
    await owner.page
      .getByRole('button', { name: 'Xác nhận bảo trì', exact: true })
      .click()
    await expect(owner.page.locator('.calendar-row.maintenance')).toContainText(
      visibleEnd
    )
    await owner.page.reload()
    await expect(owner.page.locator('.calendar-row.maintenance')).toContainText(
      visibleEnd
    )
  } finally {
    await owner.context.close()
  }
})
