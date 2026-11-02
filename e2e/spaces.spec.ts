import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Space reservations (COS-SPACES-001): Library, Music Room and Chill Zone. Every space is a labelled
 * demo fixture; nothing here is a library system, a campus allocation or an access control.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function audit(page: Page, label: string) {
  await page.waitForTimeout(500) // let a fading toast finish so contrast is measured on settled colours
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  )
  expect(summary, `${label}: axe violations`).toEqual([])
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

const paths = [
  '/bookings',
  '/bookings/library',
  '/bookings/library/books',
  '/bookings/library/loans',
  '/bookings/library/spaces/DEMO-LIB-ROOM-1',
  '/bookings/music-room',
  '/bookings/chill-zone',
  '/bookings/my',
]

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`SR-AT-30 Space pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await noOverflow(page), `${path} at ${width}px`).toBe(false)
    }
  })
}

async function enableOps(page: Page) {
  await page.goto('/settings')
  await page.getByRole('checkbox', { name: /Show Demo Operations/ }).check()
}

/** Tomorrow's evening, so the 11:45 pm slot is in the future whenever the suite runs. */
async function pickTomorrow(page: Page) {
  await page.getByLabel('Date', { exact: true }).selectOption({ index: 1 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('SR-AT-18 / SR-AT-30: a midnight booking shows both dates in full on a phone, and is confirmed', async ({
    page,
  }) => {
    await page.goto('/bookings/chill-zone')
    await expect(page.getByRole('heading', { level: 1, name: 'Chill Zone' })).toBeVisible()
    await pickTomorrow(page)
    await page.getByRole('button', { name: '11:45 pm', exact: true }).click()
    const review = page.getByText(/^Review: Demo Spot 1/)
    await expect(review).toContainText('→')
    await expect(
      page.getByText(/not campus approval, gives no right to occupy any area/),
    ).toBeVisible()
    const box = (await review.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(375) // the interval is not clipped
    expect(await noOverflow(page)).toBe(false)
    await audit(page, 'Chill Zone review (phone)')
    await page.getByRole('button', { name: 'Confirm demo reservation' }).click()
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
    await page.goto('/bookings/my')
    await expect(page.getByText(/Demo Spot 1 · /)).toBeVisible()
    await audit(page, 'My bookings with an overnight booking (phone)')
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('SR-AT-29: a library room can be reserved from the keyboard alone', async ({ page }) => {
    await page.goto('/bookings/library')
    await pickTomorrow(page)
    const slot = page.getByRole('button', { name: '2:00 pm', exact: true })
    await slot.focus()
    await page.keyboard.press('Enter')
    const confirm = page.getByRole('button', { name: 'Confirm demo reservation' })
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
  })

  test('SR-AT-18 / SR-AT-23: an overnight booking appears on both Calendar days and once in Home', async ({
    page,
  }) => {
    await page.goto('/bookings/chill-zone')
    await pickTomorrow(page)
    await page.getByRole('button', { name: '11:45 pm', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm demo reservation' }).click()
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
    await page.goto('/')
    await expect(
      page
        .getByRole('region', { name: 'My activity' })
        .getByText(/Demo Spot 1 \(demo reservation\)/),
    ).toHaveCount(1)
    await page.goto('/bookings/my')
    await page.getByRole('link', { name: 'Open booking' }).click()
    await page.getByRole('link', { name: 'Open this day in Calendar' }).click()
    await expect(page.getByText(/Demo Spot 1 \(demo reservation\)/).first()).toBeVisible()
  })

  test('SR-AT-14 / SR-AT-15 / SR-AT-25: closing the music room blocks new bookings, flags the existing one and alerts once', async ({
    page,
  }) => {
    await enableOps(page)
    await page.goto('/bookings/music-room')
    await pickTomorrow(page)
    await page.getByRole('button', { name: '11:30 am', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm demo reservation' }).click()
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
    const row = page
      .getByTestId('demo-ops')
      .getByRole('listitem')
      .filter({ hasText: 'Demo music room' })
      .first()
    await row.getByLabel('Closure reason').fill('Floor repair')
    await row.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByText(/Closed\./).first()).toBeVisible()
    await page.goto('/bookings/my')
    await expect(page.getByText(/Needs your attention \(1\)/)).toBeVisible()
    await page.goto('/notifications')
    await expect(
      page.getByRole('link', { name: /Open: Your demo reservation may be affected/ }),
    ).toHaveCount(1)
    await audit(page, 'Notifications with a disruption alert')
  })

  test('SR-AT-10 / SR-AT-11: a simulator-entered loan shows a date-only due date, and its reminder is in-app', async ({
    page,
  }) => {
    await enableOps(page)
    await page.goto('/bookings/library')
    const ops = page.getByTestId('demo-ops')
    await ops.getByLabel('Due date (date only)').fill('2099-01-10')
    await ops.getByRole('button', { name: 'Add demo loan' }).click()
    await page.goto('/bookings/library/loans')
    await expect(page.getByText(/date only: no time is implied/)).toBeVisible()
    await expect(
      page.getByText(/Only the demo simulator can record a return/).first(),
    ).toBeVisible()
    await audit(page, 'Library loans')
  })

  test('SR-AT-07: the library occupancy is unknown, then a labelled simulated snapshot, never a verified count', async ({
    page,
  }) => {
    await page.goto('/bookings/library')
    await expect(page.getByText(/Unknown. No occupancy snapshot has been recorded./)).toBeVisible()
    await enableOps(page)
    await page.goto('/bookings/library')
    const ops = page.getByTestId('demo-ops')
    await ops.getByLabel('Facility').selectOption('DEMO-LIBRARY')
    await ops.getByLabel('Active check-ins (blank = unknown)').fill('6')
    await ops.getByRole('button', { name: 'Record simulated snapshot' }).click()
    await expect(page.getByText(/Reported active check-ins: 6 · .*not a live count/)).toBeVisible()
    await expect(page.getByText(/Occupancy not verified/)).toBeVisible()
    await audit(page, 'Library with a simulated snapshot')
  })
})
