import { expect, test } from '@playwright/test'
import { actor, court, day, slot } from './review-fixtures'

test('PA3 release retains address and booking access with GPS denied and map deferred', async ({ browser }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'Uses guarded local fixtures.')
  const owner = await actor(browser, 'release-detail-owner', true)
  const player = await actor(browser, 'release-detail-player')
  try {
    const venue = await court(owner.page, 'PA3 address')
    await slot(owner.page, venue.id, 8)
    await slot(owner.page, venue.id, 9, day, { blocked: true })
    const cdp = await player.context.newCDPSession(player.page)
    const { targetInfo } = await cdp.send('Target.getTargetInfo')
    await cdp.send('Browser.setPermission', {
      permission: { name: 'geolocation' },
      setting: 'denied',
      origin: 'http://localhost:5173',
      browserContextId: targetInfo.browserContextId,
    })
    await player.page.goto('/?q=' + encodeURIComponent(venue.name))
    await player.page.getByRole('link', { name: 'Xem sân →', exact: true }).click()
    await expect(player.page.getByText(venue.address, { exact: false }).first()).toBeVisible()
    await expect(player.page.locator('iframe')).toHaveCount(0)
    await expect(player.page.getByText('Vị trí & chỉ đường', { exact: true })).toHaveCount(0)
    await player.page.getByRole('link', { name: 'Xem giờ trống', exact: true }).click()
    await player.page.getByLabel('Ngày xem lịch', { exact: true }).fill(day)
    await expect(player.page.getByRole('button', { name: /08:00–09:00/ })).toBeEnabled()
    const blocked = player.page.getByRole('button', { name: /09:00–10:00/ })
    await expect(blocked).toBeDisabled()
    await expect(blocked).toContainText('Chủ sân đã chặn giờ này')
  } finally {
    await owner.context.close()
    await player.context.close()
  }
})
