import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// These journeys pick evening slots, so they run at a fixed 2 Nov 2026, 14:00 IST instead of the real clock
// (otherwise they fail after 6 pm).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2026-11-02T08:30:00Z')
})

/**
 * Campus Essentials journeys (COS-ESSENTIALS-001 ESS-S05 and the end-to-end flows). All data is
 * labelled demo data; nothing reaches a provider, sensor, payment system or courier.
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
  '/services',
  '/services/laundry',
  '/services/laundry/ss',
  '/services/laundry/machines',
  '/services/mess',
  '/services/mess/fees',
  '/services/parcels',
]

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`ESS-S05 Essentials pages have no horizontal overflow at ${width}px`, async ({ page }) => {
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

test.describe('phone journey', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('ESS-S05: register a laundry load and reserve a machine on a phone', async ({ page }) => {
    await page.goto('/services')
    await page.getByRole('link', { name: /Laundry/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Laundry' })).toBeVisible()
    await page.getByRole('link', { name: 'See next reported visit' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'SS Laundry' })).toBeVisible()
    await page.getByLabel('Receipt or bag reference (optional)').fill('PHONE-1')
    await page.getByRole('button', { name: 'Register load (self-reported)' }).click()
    await expect(page.getByText(/Registered as/)).toContainText('Student reported')
    await audit(page, 'SS Laundry with a registered load (phone)')

    await page.goto('/services/laundry/machines')
    await page.getByRole('button', { name: 'Choose Sample washer 1' }).click()
    await page
      .getByRole('button', { name: /^(?:8:00 pm|7:00 pm|6:00 pm)(?! · past)/ })
      .first()
      .click()
    await page.getByRole('button', { name: 'Confirm demo reservation' }).click()
    await expect(
      page.getByRole('region', { name: 'My reservations' }).getByText('Reserved', { exact: true }),
    ).toBeVisible()
    expect(await noOverflow(page)).toBe(false)
    await audit(page, 'Machines with a reservation (phone)')
  })
})

test.describe('desktop journeys', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('ESS-L03 / ESS-L06: the laundry simulator moves a load and Home and the inbox follow, keyboard only for the form', async ({
    page,
  }) => {
    await page.goto('/services/laundry/ss')
    await page.getByLabel('Receipt or bag reference (optional)').focus()
    await page.keyboard.type('KEY-1')
    await page.keyboard.press('Enter') // submits the form from the keyboard
    await expect(page.getByText(/Registered as/)).toBeVisible()

    await enableOps(page)
    await page.goto('/services/laundry/ss')
    const ops = page.getByTestId('demo-ops')
    await expect(ops).toBeVisible()
    await audit(page, 'Laundry simulator')
    await ops.getByRole('button', { name: 'Announce visit' }).click()
    await ops.getByRole('button', { name: 'Record provider on campus' }).click()
    for (const step of [
      /^Mark received/,
      /^Mark processing/,
      /^Mark back on campus/,
      /^Mark ready for collection/,
    ])
      await ops.getByRole('button', { name: step }).click()

    await page.goto('/')
    const activity = page.getByRole('region', { name: 'My activity' })
    await expect(activity.getByText(/SS Laundry load/)).toBeVisible()
    await expect(activity.getByText(/Ready for collection/)).toBeVisible()
    await page.goto('/notifications')
    await expect(page.getByRole('link', { name: /Open: Your laundry is ready/ })).toBeVisible()
  })

  test('ESS-P01 / ESS-P02 / ESS-P05: the parcel simulator logs, the student sees it, and collection is recorded only by the simulator', async ({
    page,
  }) => {
    await enableOps(page)
    await page.goto('/services/parcels')
    await expect(page.getByText(/No parcels are logged for you/)).toBeVisible()
    await page.getByTestId('demo-ops').getByRole('button', { name: 'Log parcel' }).click()
    await expect(page.getByRole('link', { name: /Collect parcel details/ })).toBeVisible()
    await page.getByRole('link', { name: /Collect parcel details/ }).click()
    await expect(page.getByText(/Collection point unknown/)).toBeVisible()
    await expect(page.getByRole('button', { name: /mark.*collected/i })).toHaveCount(0)
    await audit(page, 'Parcel detail')
    await page.goto('/services/parcels')
    await page.getByTestId('demo-ops').getByRole('button', { name: 'Record collected' }).click()
    await expect(page.getByText('Collection recorded').first()).toBeVisible()
  })

  test('ESS-P04: a backdated parcel earns one uncollected reminder', async ({ page }) => {
    await enableOps(page)
    await page.goto('/services/parcels')
    const ops = page.getByTestId('demo-ops')
    await ops.getByLabel(/Backdate the simulated arrival/).check()
    await ops.getByRole('button', { name: 'Log parcel' }).click()
    await page.goto('/notifications')
    await expect(page.getByText('Parcel still uncollected (demo)')).toHaveCount(1)
  })

  test('ESS-M06 / ESS-M07: fee details appear only when typed in, and the form link opens externally', async ({
    page,
  }) => {
    await page.goto('/services/mess/fees')
    await expect(page.getByText('No fee details available')).toBeVisible()
    await enableOps(page)
    await page.goto('/services/mess')
    const ops = page.getByTestId('demo-ops')
    await ops.getByLabel('Amount in rupees (optional)').fill('2500')
    await ops
      .getByLabel('Payment form link (optional, https only)')
      .fill('https://example.test/form')
    await ops.getByRole('button', { name: 'Save fee details' }).click()
    await page.goto('/services/mess/fees')
    const link = page.getByRole('link', { name: /Open the supplied payment form/ })
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await page.getByRole('button', { name: 'I submitted it (self-report)' }).click()
    await expect(
      page.getByText(/You reported submitting it \(not a receipt\)/).first(),
    ).toBeVisible()
    await expect(page.getByText(/^Verified paid$/)).toHaveCount(0)
    await audit(page, 'Mess fees with details')
  })

  test('ESS-S04: the scoped Essentials reset leaves Chill Spot data alone', async ({ page }) => {
    await page.goto('/services/chill-spot')
    await page
      .getByRole('button', { name: /^Choose/ })
      .first()
      .click()
    await page.getByRole('button', { name: /Add to cart/ }).click()
    await page.getByRole('button', { name: 'Review checkout' }).click()
    await page
      .getByRole('dialog', { name: /Review your demo order/ })
      .getByRole('button', { name: 'Place demo order request' })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: /^Order CS-/ })).toBeVisible()

    await enableOps(page)
    await page.goto('/services/parcels')
    await page.getByTestId('demo-ops').getByRole('button', { name: 'Log parcel' }).click()
    await page.getByRole('button', { name: 'Reset Essentials demo records…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reset Essentials records' }).click()
    await expect(page.getByText(/No parcels are logged for you/)).toBeVisible()
    await page.goto('/services/chill-spot?tab=orders')
    await expect(page.getByText(/CS-0006/).first()).toBeVisible()
  })
})
