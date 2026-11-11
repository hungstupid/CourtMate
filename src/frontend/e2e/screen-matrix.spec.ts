import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  actor,
  api,
  book,
  court,
  day,
  marker,
  photo,
  slot,
} from './review-fixtures'
import type { Page } from '@playwright/test'
import type { Room, Slot } from '../src/lib/types'

test('screen-by-screen usability: real Guest/Player/Owner states at 375/768/1280px @a11y', async ({
  browser,
}) => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Real fixtures use only local database/demo emulator.'
  )
  test.setTimeout(240000)
  const owner = await actor(browser, 'matrix-owner', true)
  const player = await actor(browser, 'matrix-player')
  const guest = await browser.newContext({ baseURL: 'http://localhost:5173' })
  const publicPage = await guest.newPage()
  const observations: unknown[] = []
  try {
    // Actual empty Owner/account screens, before making this actor's fixtures.
    const views: { page: Page; name: string; path: string }[] = [
      { page: owner.page, name: 'Owner courts empty', path: '/owner' },
      {
        page: owner.page,
        name: 'Owner calendar empty',
        path: '/owner/schedule',
      },
      {
        page: owner.page,
        name: 'Owner bookings empty',
        path: '/owner/bookings',
      },
      { page: owner.page, name: 'Owner offers empty', path: '/owner/offers' },
      { page: player.page, name: 'Player history empty', path: '/bookings' },
      { page: publicPage, name: 'Login', path: '/login' },
      { page: publicPage, name: 'Registration', path: '/register' },
      {
        page: publicPage,
        name: 'Court search empty',
        path: `/?q=${marker}-no-match`,
      },
      {
        page: publicPage,
        name: 'Room search empty',
        path: `/rooms?location=${marker}-no-match`,
      },
    ]
    async function inspect({ page, name, path }: (typeof views)[number]) {
      const errors: string[] = []
      const onError = (error: Error) => errors.push(error.message)
      page.on('pageerror', onError)
      try {
        await page.goto(path, { waitUntil: 'networkidle' })
        await expect(page.getByRole('main')).toBeVisible()
        await expect(page.locator('.loading-state')).toHaveCount(0)
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
        if (name === 'Court search empty')
          await expect(
            page.getByRole('heading', {
              name: 'Không có sân phù hợp',
              exact: true,
            })
          ).toBeVisible()
        if (name === 'Court discovery populated') {
          await expect(page.locator('.court-card')).toHaveCount(1)
          await expect(page.getByLabel('Tên sân', { exact: true })).toHaveValue(
            new URL(page.url()).searchParams.get('q')!
          )
        }
        for (const width of [375, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 })
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth
            ),
            `${name} ${width}px`
          ).toBe(true)
          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
          expect(axe.violations, `${name} ${width}px`).toEqual([])
          const targets = await page
            .locator('button:visible')
            .evaluateAll((nodes) =>
              nodes
                .map((node) => {
                  const r = node.getBoundingClientRect()
                  return {
                    text: node.textContent?.trim(),
                    width: r.width,
                    height: r.height,
                  }
                })
                .filter((r) => r.width < 24 || r.height < 24)
            )
          observations.push({
            name,
            width,
            noOverflow: true,
            axeViolations: 0,
            smallButtons: targets,
          })
          await page.screenshot({
            path: join(
              tmpdir(),
              `courtmate-screen-${name.replaceAll(' ', '-').toLowerCase()}-${width}.png`
            ),
            fullPage: true,
          })
        }
        expect(errors, `${name} page errors`).toEqual([])
      } finally {
        page.off('pageerror', onError)
      }
    }
    for (const view of views) await inspect(view)
    const c = await court(owner.page, 'Screen matrix', 'Cầu lông', [photo])
    const booked = await slot(owner.page, c.id, 8)
    const scheduled = await slot(owner.page, c.id, 9)
    const available = await slot(owner.page, c.id, 10)
    const booking = await book(player.page, [booked])
    const room = await api<Room>(
      player.page,
      `/api/bookings/${booking.id}/room`,
      'POST',
      { capacity: 8 }
    )
    await api(owner.page, `/api/owner/slots/${scheduled.id}/offers`, 'POST', {
      mode: 'automatic',
      price_vnd: 90000,
      lead_hours: 3,
    })
    // An eligible real deal at any clock time; only this local fixture is 24h.
    await api(owner.page, `/api/owner/courts/${c.id}/hours`, 'PUT', {
      windows: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opens_minute: 0,
        closes_minute: 1440,
      })),
    })
    const start = new Date(
      Math.ceil((Date.now() + 3 * 3600000) / 1800000) * 1800000
    )
    const deal = await api<Slot>(
      owner.page,
      `/api/owner/courts/${c.id}/slots`,
      'POST',
      {
        start_at: start.toISOString(),
        end_at: new Date(start.getTime() + 3600000).toISOString(),
        price_vnd: 120000,
      }
    )
    await api(owner.page, `/api/owner/slots/${deal.id}/offers`, 'POST', {
      mode: 'manual',
      price_vnd: 90000,
      lead_hours: 24,
    })
    const populated = [
      {
        page: publicPage,
        name: 'Court discovery populated',
        path: `/?q=${encodeURIComponent(c.name)}`,
      },
      { page: publicPage, name: 'Court detail', path: `/courts/${c.id}` },
      {
        page: player.page,
        name: 'Player availability',
        path: `/courts/${c.id}/slots?date=${day}`,
      },
      { page: publicPage, name: 'Deals populated', path: '/deals' },
      {
        page: publicPage,
        name: 'Rooms populated',
        path: `/rooms?location=${marker}`,
      },
      {
        page: publicPage,
        name: 'Guest room detail',
        path: `/rooms/${room.id}`,
      },
      {
        page: player.page,
        name: 'Organizer room detail',
        path: `/rooms/${room.id}`,
      },
      { page: player.page, name: 'Player booking history', path: '/bookings' },
      {
        page: player.page,
        name: 'Player booking detail',
        path: `/bookings/${booking.id}`,
      },
      { page: player.page, name: 'Player profile', path: '/profile' },
      { page: owner.page, name: 'Owner courts populated', path: '/owner' },
      { page: owner.page, name: 'Owner new court', path: '/owner/courts/new' },
      {
        page: owner.page,
        name: 'Owner edit court',
        path: `/owner/courts/${c.id}/edit`,
      },
      {
        page: owner.page,
        name: 'Owner calendar populated',
        path: `/owner/schedule?court=${c.id}&date=${day}`,
      },
      { page: owner.page, name: 'Owner booking list', path: '/owner/bookings' },
      {
        page: owner.page,
        name: 'Owner booking detail',
        path: `/owner/bookings/${booking.id}`,
      },
      {
        page: owner.page,
        name: 'Owner offer configuration',
        path: `/owner/offers?court=${c.id}&date=${day}&slot=${available.id}`,
      },
      {
        page: owner.page,
        name: 'Owner scheduled offer',
        path: `/owner/offers?court=${c.id}&date=${day}&slot=${scheduled.id}`,
      },
      { page: owner.page, name: 'Owner profile', path: '/profile' },
    ]
    for (const view of populated) await inspect(view)
    await writeFile(
      join(tmpdir(), 'courtmate-screen-matrix.json'),
      JSON.stringify(observations, null, 2)
    )
    console.log(
      `Screen usability matrix: ${views.length + populated.length} real screen states × 3 widths; detailed observations/screenshots in OS temporary directory.`
    )
  } finally {
    await owner.context.close()
    await player.context.close()
    await guest.close()
  }
})
