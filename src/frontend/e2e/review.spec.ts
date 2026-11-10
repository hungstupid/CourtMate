import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import type { Booking, Court, Room, Slot } from '../src/lib/types'
import { localDay } from '../src/lib/format'
import {
  actor,
  api,
  book,
  court,
  day,
  marker,
  nextDay,
  password,
  photo,
  slot,
} from './review-fixtures'

test.beforeEach(() => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Guarded local review fixtures only.'
  )
})

async function accessible(page: Page, name: string) {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(geometry.content, `${name} at ${width}px`).toBeLessThanOrEqual(
      geometry.width
    )
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(result.violations, `${name} at ${width}px`).toEqual([])
  }
}

async function logout(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
}

async function unauthenticated(page: Page) {
  expect(
    await page.evaluate(async () => {
      // @ts-expect-error Vite source module.
      const { firebaseAuth } = await import('/src/lib/firebase.ts')
      // @ts-expect-error Vite source module.
      const { API_BASE_URL } = await import('/src/lib/api.ts')
      return {
        signedIn: Boolean(firebaseAuth.currentUser),
        protectedStatus: (await fetch(`${API_BASE_URL}/api/bookings`)).status,
      }
    })
  ).toEqual({ signedIn: false, protectedStatus: 401 })
}

test('AC-F01-02 duplicate Firebase email cannot replace the registered Player role', async ({
  browser,
}) => {
  const player = await actor(browser, 'duplicate')
  try {
    const identity = await api(player.page, '/api/me')
    await logout(player.page)
    await player.page.goto('/register')
    await player.page.getByLabel('Email', { exact: true }).fill(player.email)
    await player.page.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await player.page.getByRole('radio', { name: /Chủ sân/ }).check()
    let registrations = 0
    player.page.on('request', (r) => {
      if (r.url().endsWith('/api/register') && r.method() === 'POST')
        registrations++
    })
    const provider = player.page.waitForResponse((r) =>
      r.url().includes('accounts:signUp')
    )
    await player.page
      .getByRole('button', { name: 'Tạo tài khoản', exact: true })
      .click()
    expect((await provider).status()).toBe(400)
    await expect(player.page.getByRole('alert')).toContainText(
      'Email đã được đăng ký. Hãy đăng nhập.'
    )
    expect(registrations).toBe(0)
    await unauthenticated(player.page)
    await player.page.goto('/login')
    await player.page.getByLabel('Email', { exact: true }).fill(player.email)
    await player.page.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await player.page
      .getByRole('button', { name: 'Đăng nhập', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/$/)
    expect(await api(player.page, '/api/me')).toEqual(identity)
  } finally {
    await player.context.close()
  }
})

test('AC-F01-04 real Firebase wrong password fails closed and valid retry recovers', async ({
  browser,
}) => {
  const player = await actor(browser, 'wrong-password')
  try {
    const identity = await api(player.page, '/api/me')
    await logout(player.page)
    await player.page.getByLabel('Email', { exact: true }).fill(player.email)
    await player.page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('Wrong-password-123!')
    const provider = player.page.waitForResponse((r) =>
      r.url().includes('accounts:signInWithPassword')
    )
    await player.page
      .getByRole('button', { name: 'Đăng nhập', exact: true })
      .click()
    expect((await provider).status()).toBe(400)
    await expect(player.page.getByRole('alert')).toContainText(
      /credentials|Email hoặc mật khẩu không đúng/
    )
    await expect(player.page.getByLabel('Email', { exact: true })).toHaveValue(
      player.email
    )
    await unauthenticated(player.page)
    await accessible(player.page, 'Login error')
    await player.page.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await player.page
      .getByRole('button', { name: 'Đăng nhập', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/profile$/)
    expect(await api(player.page, '/api/me')).toEqual(identity)
  } finally {
    await player.context.close()
  }
})

test('AC-F02-07 Bóng prefix options and selection preserve every other search criterion', async ({
  browser,
}) => {
  const owner = await actor(browser, 'sports', true)
  try {
    const courts = await Promise.all(
      ['Bóng đá', 'Bóng rổ', 'Cầu lông'].map((sport, i) =>
        court(owner.page, `Sports ${i}`, sport)
      )
    )
    for (const c of courts) await slot(owner.page, c.id, 8)
    await owner.page.goto('/')
    const filters = {
      'Tên sân': `${marker} Sports`,
      'Địa chỉ hoặc khu vực': marker,
      'Bắt đầu · tùy chọn': `${day}T08:00`,
      'Kết thúc · tùy chọn': `${day}T09:00`,
    }
    for (const [label, value] of Object.entries(filters))
      await owner.page.getByLabel(label, { exact: true }).fill(value)
    await owner.page.getByRole('button', { name: /Môn thể thao/ }).click()
    await owner.page
      .getByRole('textbox', { name: 'Tìm môn theo tiền tố' })
      .fill('bÓnG')
    expect(
      (await owner.page.getByRole('option').allTextContents()).sort()
    ).toEqual(['Tất cả môn', 'Bóng đá', 'Bóng rổ'].sort())
    await owner.page.keyboard.press('ArrowDown')
    await owner.page.keyboard.press('ArrowDown')
    await expect(owner.page.getByRole('option').nth(1)).toBeFocused()
    const selected = await owner.page.getByRole('option').nth(1).textContent()
    await owner.page.keyboard.press('Enter')
    for (const [label, value] of Object.entries(filters))
      await expect(owner.page.getByLabel(label, { exact: true })).toHaveValue(
        value
      )
    await owner.page
      .getByRole('button', { name: 'Tìm sân', exact: true })
      .click()
    await expect(owner.page.locator('.court-card')).toHaveCount(1)
    await expect(owner.page.locator('.court-card')).toContainText(
      courts.find((c) => c.sport === selected)!.name
    )
    const query = new URL(owner.page.url()).searchParams
    expect(query.get('sport')).toBe(selected)
    await accessible(owner.page, 'Filtered discovery')
  } finally {
    await owner.context.close()
  }
})

test('AC-F06-07 court edit preserves identity and allows optional contact to remain empty', async ({
  browser,
}) => {
  const owner = await actor(browser, 'edit', true)
  const player = await actor(browser, 'edit-player')
  try {
    const original = await court(owner.page, 'Before')
    const booking = await book(player.page, [
      await slot(owner.page, original.id, 8),
    ])
    const room = await api<Room>(
      player.page,
      `/api/bookings/${booking.id}/room`,
      'POST',
      { capacity: 4 }
    )
    const bookingBefore = await api<Booking>(
      player.page,
      `/api/bookings/${booking.id}`
    )
    const roomBefore = await api<Room>(
      player.page,
      `/api/rooms/${room.id}/membership`
    )
    await owner.page.goto(`/owner/courts/${original.id}/edit`)
    await expect(
      owner.page.getByLabel('Liên hệ sân', { exact: true })
    ).toHaveValue('')
    await owner.page
      .getByLabel('Tên sân', { exact: true })
      .fill(`${original.name} Updated`)
    const saved = owner.page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/owner/courts/${original.id}`) &&
        r.request().method() === 'PATCH'
    )
    await owner.page
      .getByRole('button', { name: 'Lưu thông tin sân', exact: true })
      .click()
    expect((await saved).status()).toBe(200)
    await expect(owner.page).toHaveURL(/\/owner$/)
    const result = await api<Court>(
      owner.page,
      `/api/owner/courts/${original.id}`
    )
    expect(result).toMatchObject({
      id: original.id,
      owner_id: original.owner_id,
      name: `${original.name} Updated`,
      contact: '',
    })
    await owner.page.goto(`/owner/courts/${original.id}/edit`)
    const fields = {
      'Môn thể thao': 'Pickleball',
      'Địa chỉ đầy đủ': `99 Đường mới, ${marker}`,
      'Khu vực': marker,
      'Giá cơ bản / giờ (₫)': '150000',
      'Người chơi đồng thời': '10',
      'Mô tả sân': 'Thông tin cập nhật qua giao diện thật.',
      'Liên hệ sân': 'test-venue-contact',
      'URL ảnh (mỗi dòng một URL)': photo,
    }
    for (const [label, value] of Object.entries(fields))
      await owner.page.getByLabel(label, { exact: true }).fill(value)
    await accessible(owner.page, 'Owner court edit')
    await owner.page
      .getByRole('button', { name: 'Lưu thông tin sân', exact: true })
      .click()
    await expect(owner.page).toHaveURL(/\/owner$/)
    await owner.page.goto(`/owner/courts/${original.id}/edit`)
    for (const [label, value] of Object.entries(fields))
      await expect(owner.page.getByLabel(label, { exact: true })).toHaveValue(
        value
      )
    await owner.page.getByLabel('Tên sân', { exact: true }).fill('Unsaved name')
    await owner.page
      .getByRole('link', { name: 'Hủy, chưa lưu', exact: true })
      .click()
    expect(
      (await api<Court>(owner.page, `/api/owner/courts/${original.id}`)).name
    ).toBe(`${original.name} Updated`)
    const bookingAfter = await api<Booking>(
      player.page,
      `/api/bookings/${booking.id}`
    )
    for (const key of [
      'id',
      'status',
      'start_at',
      'end_at',
      'total_price_vnd',
      'slots',
    ] as const)
      expect(bookingAfter[key]).toEqual(bookingBefore[key])
    const roomAfter = await api<Room>(
      player.page,
      `/api/rooms/${room.id}/membership`
    )
    for (const key of [
      'id',
      'booking_id',
      'status',
      'capacity',
      'members',
      'member_count',
    ] as const)
      expect(roomAfter[key]).toEqual(roomBefore[key])
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

test('AC-F03-04 denied GPS requires explicit origin before opening directions', async ({
  browser,
}) => {
  const owner = await actor(browser, 'map', true)
  try {
    const c = await court(owner.page, 'Map')
    const cdp = await owner.context.newCDPSession(owner.page)
    const { targetInfo } = await cdp.send('Target.getTargetInfo')
    await cdp.send('Browser.setPermission', {
      permission: { name: 'geolocation' },
      setting: 'denied',
      origin: 'http://localhost:5173',
      browserContextId: targetInfo.browserContextId,
    })
    await owner.page.goto(`/courts/${c.id}`)
    expect(
      await owner.page.evaluate(
        async () =>
          (await navigator.permissions.query({ name: 'geolocation' })).state
      )
    ).toBe('denied')
    await owner.page.getByText('Vị trí & chỉ đường', { exact: true }).click()
    await expect(owner.page.getByTitle(`Bản đồ ${c.name}`)).toHaveAttribute(
      'src',
      /maps.google.com/
    )
    await expect(
      owner.page.getByRole('link', {
        name: 'Xem vị trí trên bản đồ ↗',
        exact: true,
      })
    ).toHaveAttribute('href', new RegExp(encodeURIComponent(c.address)))
    await expect(
      owner.page.getByRole('link', { name: 'Mở chỉ đường ↗', exact: true })
    ).toHaveCount(0)
    await expect(
      owner.page.getByRole('button', { name: /Nhập điểm đi để chỉ đường/ })
    ).toBeDisabled()
    const origin = 'Bến xe Miền Đông, Thành phố Hồ Chí Minh'
    await owner.page.getByLabel('Điểm xuất phát', { exact: true }).fill(origin)
    const href = await owner.page
      .getByRole('link', { name: 'Mở chỉ đường ↗', exact: true })
      .getAttribute('href')
    const target = new URL(href!)
    expect(target.searchParams.get('origin')).toBe(origin)
    expect(target.searchParams.get('destination')).toBe(c.address)
    await owner.page.getByLabel('Điểm xuất phát', { exact: true }).fill('   ')
    await expect(
      owner.page.getByRole('link', { name: 'Mở chỉ đường ↗', exact: true })
    ).toHaveCount(0)
  } finally {
    await owner.context.close()
  }
})

test('AC-F03-01 real Owner photo URL decodes in discovery and court details', async ({
  browser,
}) => {
  const owner = await actor(browser, 'photo', true)
  try {
    const c = await court(owner.page, 'Photo', 'Tennis', [photo])
    await owner.page.goto(`/?q=${encodeURIComponent(c.name)}`)
    const image = owner.page.getByRole('img', { name: c.name, exact: true })
    await expect(image).toHaveAttribute('src', photo)
    expect(
      await image.evaluate(async (el: HTMLImageElement) => {
        await el.decode()
        return [el.naturalWidth, el.naturalHeight]
      })
    ).toEqual([640, 427])
    await owner.page.goto(`/courts/${c.id}`)
    const detail = owner.page.getByRole('img', { name: c.name, exact: true })
    await expect(detail).toHaveAttribute('src', photo)
    expect(
      await detail.evaluate(async (el: HTMLImageElement) => {
        await el.decode()
        return el.naturalWidth
      })
    ).toBe(640)
    await accessible(owner.page, 'Court details with supplied photograph')
  } finally {
    await owner.context.close()
  }
})

test('AC-F06-15 switching two owned courts and dates confirms draft discard and scopes booked/blocked/unpublished actions', async ({
  browser,
}) => {
  const owner = await actor(browser, 'calendar', true)
  const player = await actor(browser, 'calendar-player')
  try {
    const fixtures = []
    for (let index = 0; index < 2; index++) {
      const c = await court(owner.page, `Calendar ${index}`)
      const first = index ? 14 : 8
      const bookedSlot = await slot(owner.page, c.id, first, day, {
        price_vnd: 100000 + index * 10000,
      })
      const available = await slot(owner.page, c.id, first + 1)
      await slot(owner.page, c.id, first + 2, day, { blocked: true })
      await slot(owner.page, c.id, first + 3, day, { published: false })
      const alternate = await slot(owner.page, c.id, first + 4, nextDay)
      const booking = await book(player.page, [bookedSlot])
      await api(owner.page, `/api/owner/courts/${c.id}/maintenance`, 'POST', {
        start_at: `${day}T${first + 4}:00:00+07:00`,
        end_at: `${day}T${first + 5}:00:00+07:00`,
      })
      fixtures.push({
        c,
        first,
        available,
        alternate,
        booking,
        before: await api<Slot[]>(
          owner.page,
          `/api/owner/courts/${c.id}/slots`
        ),
      })
    }
    await owner.page.goto(
      `/owner/schedule?court=${fixtures[0].c.id}&date=${day}`
    )
    for (const fixture of fixtures) {
      await owner.page
        .getByLabel('Sân đang quản lý', { exact: true })
        .selectOption(fixture.c.id)
      await owner.page.getByLabel('Ngày xem lịch', { exact: true }).fill(day)
      await expect(owner.page.locator('.calendar-row.slot')).toHaveCount(4)
      for (const status of ['booked', 'available', 'blocked', 'unpublished'])
        await expect(
          owner.page.locator(`.calendar-row.slot .badge-${status}`)
        ).toHaveCount(1)
      await expect(
        owner.page.locator('.calendar-row.gap').first()
      ).toContainText('06:00')
      await expect(
        owner.page.locator('.calendar-row.gap').last()
      ).toContainText('22:00')
      await expect(owner.page.locator('.calendar-row.maintenance')).toHaveCount(
        1
      )
      const bookedRow = owner.page
        .locator('.calendar-row.slot')
        .filter({ has: owner.page.locator('.badge-booked') })
      await expect(
        bookedRow.getByRole('button', { name: 'Sửa', exact: true })
      ).toHaveCount(0)
      await expect(
        bookedRow.getByRole('link', { name: 'Xem booking', exact: true })
      ).toHaveAttribute('href', `/owner/bookings/${fixture.booking.id}`)
      await bookedRow
        .getByRole('link', { name: 'Xem booking', exact: true })
        .click()
      await expect(owner.page.locator('.badge-confirmed')).toBeVisible()
      await owner.page.goto(`/owner/schedule?court=${fixture.c.id}&date=${day}`)
      await expect(owner.page.locator('.calendar-row.slot')).toHaveCount(4)
      await accessible(owner.page, `Calendar ${fixture.first}`)
      await owner.page.locator('.calendar-row').last().scrollIntoViewIfNeeded()
      await expect(owner.page.locator('.calendar-row').last()).toBeInViewport()
      await owner.page
        .getByRole('button', { name: 'Tạo nhanh nhiều slot', exact: true })
        .click()
      await owner.page
        .getByRole('button', { name: 'Tạo / thay danh sách nháp', exact: true })
        .click()
      await expect(
        owner.page.getByRole('heading', { name: '8 slot nháp' })
      ).toBeVisible()
      await owner.page
        .getByLabel('Ngày xem lịch', { exact: true })
        .fill(nextDay)
      await owner.page
        .getByRole('button', { name: 'Bỏ thay đổi và tiếp tục', exact: true })
        .click()
      await expect(
        owner.page.getByRole('heading', { name: '8 slot nháp' })
      ).toHaveCount(0)
      await expect(owner.page.locator('.calendar-row.slot')).toHaveCount(1)
      await expect(owner.page.locator('.calendar-row.slot')).toContainText(
        `${fixture.first + 4}:00`
      )
      await owner.page
        .getByRole('button', { name: 'Tạo nhanh nhiều slot', exact: true })
        .click()
      await owner.page
        .getByRole('button', { name: 'Tạo / thay danh sách nháp', exact: true })
        .click()
      await expect(
        owner.page.getByRole('heading', { name: '8 slot nháp' })
      ).toBeVisible()
      const other = fixtures.find((f) => f.c.id !== fixture.c.id)!
      await owner.page
        .getByLabel('Sân đang quản lý', { exact: true })
        .selectOption(other.c.id)
      await owner.page
        .getByRole('button', { name: 'Bỏ thay đổi và tiếp tục', exact: true })
        .click()
      await expect(
        owner.page.getByRole('heading', { name: '8 slot nháp' })
      ).toHaveCount(0)
      await expect(owner.page.locator('.calendar-row.slot')).toHaveCount(1)
      await expect(owner.page.locator('.calendar-row.slot')).toContainText(
        `${other.first + 4}:00`
      )
    }
    for (const fixture of fixtures)
      expect(
        await api(owner.page, `/api/owner/courts/${fixture.c.id}/slots`)
      ).toEqual(fixture.before)
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})

for (const capacity of [2, 4])
  test(`AC-F10-16/20 filtered room return and Keep-open preserve ${capacity === 2 ? 'FULL' : 'OPEN'} room, roster and booking`, async ({
    browser,
  }) => {
    const owner = await actor(browser, `room-owner-${capacity}`, true)
    const organizer = await actor(browser, `organizer-${capacity}`)
    const member = await actor(browser, `member-${capacity}`)
    try {
      const c = await court(owner.page, `Room ${capacity}`)
      const booking = await book(organizer.page, [
        await slot(owner.page, c.id, 8),
      ])
      const room = await api<Room>(
        organizer.page,
        `/api/bookings/${booking.id}/room`,
        'POST',
        { capacity }
      )
      await api(member.page, `/api/rooms/${room.id}/join`, 'POST')
      const roomBefore = await api<Room>(
        organizer.page,
        `/api/rooms/${room.id}/membership`
      )
      const bookingBefore = await api<Booking>(
        organizer.page,
        `/api/bookings/${booking.id}`
      )
      const slotsBefore = await api(
        owner.page,
        `/api/owner/courts/${c.id}/slots`
      )
      await organizer.page.goto('/rooms')
      await organizer.page
        .getByLabel('Địa chỉ hoặc khu vực', { exact: true })
        .fill(c.name.includes(marker) ? marker : c.area)
      await organizer.page
        .getByRole('button', { name: 'Tìm phòng', exact: true })
        .click()
      const listing = organizer.page.url()
      const card = organizer.page.locator('article').filter({
        has: organizer.page.getByRole('heading', {
          name: c.name,
          exact: true,
        }),
      })
      await card.getByRole('link', { name: 'Xem phòng', exact: true }).click()
      await expect(
        organizer.page.getByRole('button', { name: 'Đóng phòng', exact: true })
      ).toBeEnabled()
      await accessible(organizer.page, `${roomBefore.status} Open Play room`)
      await organizer.page
        .getByRole('link', { name: '← Danh sách phòng', exact: true })
        .click()
      await expect(organizer.page).toHaveURL(listing)
      await expect(
        organizer.page.getByLabel('Địa chỉ hoặc khu vực', { exact: true })
      ).toHaveValue(marker)
      await card.getByRole('link', { name: 'Xem phòng', exact: true }).click()
      await organizer.page.goBack()
      await expect(organizer.page).toHaveURL(listing)
      await expect(
        organizer.page.getByLabel('Địa chỉ hoặc khu vực', { exact: true })
      ).toHaveValue(marker)
      await card.getByRole('link', { name: 'Xem phòng', exact: true }).click()
      const close = organizer.page.getByRole('button', {
        name: 'Đóng phòng',
        exact: true,
      })
      await close.click()
      await expect(organizer.page.getByRole('dialog')).toBeVisible()
      await accessible(organizer.page, 'Close room confirmation')
      const dialog = organizer.page.getByRole('dialog')
      for (let i = 0; i < 6; i++) {
        await organizer.page.keyboard.press('Tab')
        // Native dialogs may send Tab to browser chrome (document.activeElement
        // becomes body); they must never focus an inert application control.
        expect(
          await dialog.evaluate(
            (el) =>
              document.activeElement === document.body ||
              el.contains(document.activeElement)
          )
        ).toBe(true)
      }
      await organizer.page
        .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(close).toBeFocused()
      await organizer.page.keyboard.press('Enter')
      await organizer.page.keyboard.press('Escape')
      await expect(close).toBeFocused()
      expect(
        await api(organizer.page, `/api/rooms/${room.id}/membership`)
      ).toEqual(roomBefore)
      expect(await api(organizer.page, `/api/bookings/${booking.id}`)).toEqual(
        bookingBefore
      )
      expect(await api(owner.page, `/api/owner/courts/${c.id}/slots`)).toEqual(
        slotsBefore
      )
      await close.click()
      await organizer.page
        .getByRole('button', { name: 'Xác nhận đóng phòng', exact: true })
        .click()
      await expect(close).toBeDisabled()
      const closed = await api<Room>(
        organizer.page,
        `/api/rooms/${room.id}/membership`
      )
      expect(closed).toMatchObject({
        id: room.id,
        status: 'CLOSED',
        closed_reason: 'ORGANIZER_CLOSED',
        members: roomBefore.members,
        member_count: 2,
      })
      const publicClosed = await api(organizer.page, `/api/rooms/${room.id}`)
      expect(
        await api(organizer.page, `/api/rooms/${room.id}/close`, 'POST')
      ).toEqual(publicClosed)
      expect(
        await api(organizer.page, `/api/rooms/${room.id}/membership`)
      ).toEqual(closed)
      expect(await api(organizer.page, `/api/bookings/${booking.id}`)).toEqual(
        bookingBefore
      )
      expect(await api(owner.page, `/api/owner/courts/${c.id}/slots`)).toEqual(
        slotsBefore
      )
      await member.page.goto(`/rooms/${room.id}`)
      await expect(
        member.page.getByRole('button', { name: 'Rời phòng', exact: true })
      ).toBeDisabled()
      await accessible(member.page, 'Closed room membership')
    } finally {
      await owner.context.close()
      await organizer.context.close()
      await member.context.close()
    }
  })

test('F09 real manual offer, accepted booking, Keep/deactivate and cancellation retain the accepted total', async ({
  browser,
}) => {
  const owner = await actor(browser, 'manual-offer', true)
  const player = await actor(browser, 'manual-offer-player')
  try {
    const c = await court(owner.page, 'Manual offer')
    await api(owner.page, `/api/owner/courts/${c.id}/hours`, 'PUT', {
      windows: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opens_minute: 0,
        closes_minute: 1440,
      })),
    })
    const start = new Date(Date.now() + 8 * 3600000)
    start.setUTCMinutes(0, 0, 0)
    const date = localDay(start)
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
    await owner.page.goto(
      `/owner/offers?court=${c.id}&date=${date}&slot=${s.id}`
    )
    await owner.page
      .getByRole('button', { name: 'Thủ công', exact: true })
      .click()
    await owner.page
      .getByLabel('Giá ưu đãi cho cả slot (₫)', { exact: true })
      .fill('90000')
    await owner.page.getByRole('button', { name: /Xem lại ưu đãi/ }).click()
    await expect(owner.page.getByRole('dialog')).toBeVisible()
    await accessible(owner.page, 'Manual offer confirmation')
    await owner.page
      .getByRole('button', { name: 'Tạo ưu đãi thủ công', exact: true })
      .click()
    await expect(
      owner.page.locator('.offer-record .badge-active')
    ).toBeVisible()
    await accessible(owner.page, 'Active F09 offer')
    await player.page.goto(`/courts/${c.id}/slots?date=${date}`)
    await expect(player.page.locator('.slot-row del')).toContainText('120.000')
    await player.page.locator('.slot-row').click()
    await player.page
      .getByRole('button', { name: 'Xem lại đặt sân', exact: true })
      .click()
    await expect(
      player.page.getByRole('dialog').locator('.total')
    ).toContainText('90.000')
    await player.page
      .getByRole('button', { name: 'Xác nhận đặt sân', exact: true })
      .click()
    await expect(player.page).toHaveURL(/\/bookings\/[a-f0-9-]+$/)
    const bookingId = player.page.url().split('/').at(-1)!
    const before = await api<Booking>(player.page, `/api/bookings/${bookingId}`)
    expect(before.total_price_vnd).toBe(90000)
    await accessible(player.page, 'Confirmed discounted booking')
    await owner.page.reload()
    await expect(owner.page.locator('.offer-record')).toContainText(
      'Đang hoạt động'
    )
    await owner.page
      .getByRole('button', { name: 'Tắt ưu đãi', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Giữ nguyên / Quay lại', exact: true })
      .click()
    await expect(owner.page.locator('.offer-record')).toContainText(
      'Đang hoạt động'
    )
    await owner.page
      .getByRole('button', { name: 'Tắt ưu đãi', exact: true })
      .click()
    await owner.page
      .getByRole('button', { name: 'Xác nhận tắt', exact: true })
      .click()
    await expect(owner.page.locator('.offer-record')).toContainText('Đã tắt')
    expect(await api(player.page, `/api/bookings/${bookingId}`)).toEqual(before)
    await player.page
      .getByRole('button', { name: 'Hủy toàn bộ booking', exact: true })
      .click()
    await player.page
      .getByRole('button', { name: 'Xác nhận hủy booking', exact: true })
      .click()
    await expect(player.page.locator('.badge-cancelled')).toBeVisible()
    const cancelled = await api<Booking>(
      player.page,
      `/api/bookings/${bookingId}`
    )
    expect(cancelled.total_price_vnd).toBe(90000)
    await player.page.goto(`/courts/${c.id}/slots?date=${date}`)
    await expect(player.page.locator('.slot-row')).toBeEnabled()
    await expect(player.page.locator('.slot-row del')).toHaveCount(0)
    await expect(player.page.locator('.slot-row')).toContainText('120.000')
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})
