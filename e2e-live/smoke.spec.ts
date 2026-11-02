import { expect, test } from '@playwright/test'

/**
 * Smoke test of the DEPLOYED site. It uses no real clock slots and changes only this browser's own
 * reference data, so it is safe to run at any time of day.
 */
const pages: [string, string][] = [
  ['/', 'Good'],
  ['/calendar', 'Calendar'],
  ['/services/chill-spot', 'Chill Spot'],
  ['/services/laundry', 'Laundry'],
  ['/bookings', 'Bookings'],
  ['/administration', 'Administration'],
  ['/academics', 'Academics'],
  ['/academics/courses/bms-fms', 'FMS'],
  ['/community', 'Community'],
  ['/community/clubs', 'Clubs & Committees'],
  ['/time-tax', 'Time Tax'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
  ['/sources', 'Data & Sources'],
]

for (const [path, text] of pages) {
  test(`opens ${path} directly (refresh-safe) with no console errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(text)
    expect(errors).toEqual([])
  })
}

test('an unknown address shows the in-app not-found page, not a server error', async ({ page }) => {
  await page.goto('/no/such/page')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})

test('a visitor can place a local order, which is saved and survives a refresh', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/services/chill-spot')
  await page
    .getByRole('button', { name: /^Choose/ })
    .first()
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Add to cart/ })
    .click()
  await page.getByRole('button', { name: 'Review checkout' }).click()
  await page.getByRole('button', { name: 'Place local order request' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Order CS-/ })).toBeVisible()
  await expect(page.getByTestId('next-step')).toContainText('not a confirmed order')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: /^Order CS-/ })).toBeVisible()
})

test('a visitor can create a Lost & Found report that is saved on this device', async ({
  page,
}) => {
  await page.goto('/community/lost-found/new?type=lost')
  await page.getByLabel('Title (public)').fill('Live smoke umbrella')
  await page.getByRole('button', { name: 'Publish locally' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Live smoke umbrella' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Live smoke umbrella' })).toBeVisible()
})

test('Local Operations stay hidden until a visitor switches them on in Settings', async ({
  page,
}) => {
  await page.goto('/services/chill-spot')
  await expect(page.getByTestId('demo-ops')).toHaveCount(0)
  await page.goto('/settings')
  await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
  await page.goto('/services/chill-spot')
  await expect(page.getByTestId('demo-ops')).toBeVisible()
  await expect(page.getByTestId('demo-ops')).toContainText('not the real café')
})

test('a phone-sized screen works without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  for (const path of ['/', '/calendar', '/community', '/academics']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow, path).toBe(false)
  }
})
