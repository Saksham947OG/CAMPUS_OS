import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// These journeys pick evening slots, so they run at a fixed 2 Nov 2026, 14:00 IST instead of the real clock
// (otherwise they fail after 6 pm).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2026-11-02T08:30:00Z')
})

/**
 * Sports & Fitness journeys (COS-SPORTS-001 SP-T03 and the end-to-end flows). Every facility is a
 * labelled demo fixture; nothing here reaches a real booking system, sensor or access control.
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
  '/bookings/gym',
  '/bookings/badminton',
  '/bookings/sports',
  '/bookings/resources/DEMO-COURT-1',
  '/bookings/my',
  '/bookings/waitlist',
]

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`SP-T03 Bookings pages have no horizontal overflow at ${width}px`, async ({ page }) => {
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
  await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
}

/** Late enough that "now" never makes the slot past, whenever the suite runs. */
// These specs run on the real clock, so skip slots already marked past. After 8 pm no late slot is left.
const lateSlot = /^(?:8:00 pm|7:00 pm|6:00 pm)(?! · past)/

test.describe('phone journey', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('SP-T03: reserve a badminton court on a phone and find it in My bookings', async ({
    page,
  }) => {
    await page.goto('/bookings')
    await page.locator('main a[href="/bookings/badminton"]').first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Badminton' })).toBeVisible()
    await page.getByRole('button', { name: lateSlot }).first().click()
    await expect(page.getByText(/Review: Demo badminton court 1/)).toBeVisible()
    await audit(page, 'Badminton review (phone)')
    await page.getByRole('button', { name: 'Confirm local reservation' }).click()
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
    expect(await noOverflow(page)).toBe(false)
    await page.goto('/bookings/my')
    await expect(
      page.locator('a[href^="/bookings/my/bk-"], a[href*="/classrooms/bookings/crb-"]'),
    ).toBeVisible()
    await audit(page, 'My bookings with a booking (phone)')
  })
})

test.describe('desktop journeys', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('SP-T03: a slot can be chosen and confirmed from the keyboard alone', async ({ page }) => {
    await page.goto('/bookings/badminton')
    const slot = page.getByRole('button', { name: lateSlot }).first()
    await slot.focus()
    await page.keyboard.press('Enter')
    const confirm = page.getByRole('button', { name: 'Confirm local reservation' })
    await expect(confirm).toBeVisible()
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
  })

  test('SP-T26 / SP-T27: a booking is the same record in Home, Calendar and My bookings, and cancelling updates them', async ({
    page,
  }) => {
    await page.goto('/bookings/badminton')
    await page.getByRole('button', { name: lateSlot }).first().click()
    await page.getByRole('button', { name: 'Confirm local reservation' }).click()
    await page.getByRole('link', { name: 'View this booking' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Demo badminton court 1' }),
    ).toBeVisible()
    await audit(page, 'Booking detail')
    await page.goto('/')
    await expect(
      page
        .getByRole('region', { name: 'My activity' })
        .getByText(/Demo badminton court 1 \(local reservation\)/),
    ).toHaveCount(1)
    await page.goto('/bookings/my')
    await page.locator('a[href^="/bookings/my/bk-"], a[href*="/classrooms/bookings/crb-"]').click()
    await page.getByRole('button', { name: 'Cancel booking' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible()
    await page.goto('/')
    await expect(
      page.getByRole('region', { name: 'My activity' }).getByText(/Reserved \(local reservation\)/),
    ).toHaveCount(0)
  })

  test('SP-T18: waitlist, offer and acceptance, driven by visible simulator clicks', async ({
    page,
  }) => {
    await enableOps(page)
    // Student A books; the waitlist is joined by a second profile.
    await page.goto('/bookings/badminton')
    await page.getByRole('button', { name: lateSlot }).first().click()
    await page.getByRole('button', { name: 'Confirm local reservation' }).click()
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
    await page.getByRole('button', { name: /persona/i }).click()
    await page.getByRole('menuitemradio', { name: /Reference Student B/ }).click()
    await page
      .getByRole('button', { name: /Join local waitlist for/ })
      .first()
      .click()
    await page.goto('/bookings/waitlist')
    await expect(page.getByText(/Waiting \(not a reservation\)/)).toBeVisible()
    await expect(page.getByText(/Position 1 of 1 recorded demo entries/)).toBeVisible()
    // Back to A: cancel, then the simulator offers the freed slot.
    await page.getByRole('button', { name: /persona/i }).click()
    await page.getByRole('menuitemradio', { name: /Reference Student A/ }).click()
    await page.goto('/bookings/my')
    await page.locator('a[href^="/bookings/my/bk-"], a[href*="/classrooms/bookings/crb-"]').click()
    await page.getByRole('button', { name: 'Cancel booking' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel booking' }).click()
    await page.goto('/bookings/badminton')
    await page
      .getByTestId('demo-ops')
      .getByRole('button', { name: /^Offer Demo badminton court 1/ })
      .click()
    await audit(page, 'Sports simulator')
    await page.getByRole('button', { name: /persona/i }).click()
    await page.getByRole('menuitemradio', { name: /Reference Student B/ }).click()
    await page.goto('/bookings/waitlist')
    await expect(page.getByText(/not yours until you accept/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Accept offer' }).click()
    await expect(page.getByRole('link', { name: 'View booking' })).toBeVisible()
  })

  test('SP-T09 / SP-T10: closing a court flags the booking and cancels nothing', async ({
    page,
  }) => {
    await enableOps(page)
    await page.goto('/bookings/badminton')
    await page.getByRole('button', { name: lateSlot }).first().click()
    await page.getByRole('button', { name: 'Confirm local reservation' }).click()
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
    const ops = page.getByTestId('demo-ops')
    const row = ops.getByRole('listitem').filter({ hasText: 'Demo badminton court 1' })
    await row.getByLabel('Closure reason').fill('Net being replaced')
    await row.getByRole('button', { name: 'Close', exact: true }).click()
    await page.goto('/bookings/my')
    await expect(page.getByText(/Needs your attention \(1\)/)).toBeVisible()
    await page.locator('a[href^="/bookings/my/bk-"], a[href*="/classrooms/bookings/crb-"]').click()
    await expect(page.getByText(/Nothing was cancelled for you/)).toBeVisible()
    await expect(page.getByText('Confirmed (local)').first()).toBeVisible()
  })

  test('SP-T21 / SP-T22: gym check-in is a self-report with a labelled sample', async ({
    page,
  }) => {
    await page.goto('/bookings/gym')
    await page.getByRole('button', { name: 'Check in (self-report)' }).click()
    await expect(page.getByRole('button', { name: 'You are checked in' })).toBeVisible()
    await expect(page.getByText(/not a live or verified headcount/)).toBeVisible()
    await audit(page, 'Gym with a self-report')
    await page.getByRole('button', { name: 'Check out' }).click()
    await expect(page.getByText(/Self-reported self-reported count:/).locator('..')).toContainText(
      '0 people have',
    )
  })

  test('SP-T30: the scoped Sports reset leaves Chill Spot and Essentials data alone', async ({
    page,
  }) => {
    await page.goto('/services/parcels')
    await enableOps(page)
    await page.goto('/services/parcels')
    await page.getByTestId('demo-ops').getByRole('button', { name: 'Log parcel' }).click()
    await expect(page.getByRole('link', { name: /Collect parcel details/ })).toBeVisible()
    await page.goto('/bookings/badminton')
    await page.getByRole('button', { name: lateSlot }).first().click()
    await page.getByRole('button', { name: 'Confirm local reservation' }).click()
    await expect(page.getByRole('link', { name: 'View this booking' })).toBeVisible()
    await page.getByRole('button', { name: 'Reset Sports demo records…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reset Sports records' }).click()
    await page.goto('/bookings/my')
    // Only the labelled example bookings remain: the court this test booked was cleared by the reset.
    await expect(page.getByText(/Upcoming \(1\)/)).toBeVisible()
    await expect(page.locator('a[href^="/bookings/my/bk-"]')).toHaveCount(0)
    await page.goto('/services/parcels')
    await expect(page.getByRole('link', { name: /Collect parcel details/ })).toBeVisible()
  })
})
