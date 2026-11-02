import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Chill Spot journeys (COS-CHILL-001 CH-AT-01…30). All data is the labelled demo scenario; nothing
 * here reaches a real café, and nothing advances unless the test clicks the simulator.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function audit(page: Page, label: string) {
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

async function addFirstItem(page: Page) {
  await page
    .getByRole('button', { name: /^Choose/ })
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: /Add to cart/ }).click()
  await expect(sheet).toBeHidden()
}

for (const width of [320, 375, 768, 1024, 1280, 1440]) {
  test(`CH-AT-30 Chill Spot menu and My orders have no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/services/chill-spot', '/services/chill-spot?tab=orders', '/services']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await noOverflow(page), `${path} at ${width}px`).toBe(false)
    }
  })
}

test.describe('mobile journey', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('CH-AT-01/06/30: Services → menu → item → cart → checkout → pending tracker, on a phone', async ({
    page,
  }) => {
    await page.goto('/services')
    await page.getByRole('link', { name: /Chill Spot/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Chill Spot' })).toBeVisible()
    await expect(page.getByText('Supplied Chill Spot menu')).toBeVisible()

    await page
      .getByRole('button', { name: /^Choose/ })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(400)
    await audit(page, 'Item sheet (phone)')
    await page.getByRole('button', { name: /Add to cart/ }).click()

    await page.getByRole('button', { name: /View cart/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(400)
    await audit(page, 'Cart sheet (phone)')
    await page.getByRole('button', { name: 'Review checkout' }).click()

    const checkout = page.getByRole('dialog', { name: /Review your local order/ })
    await expect(checkout).toBeVisible()
    await expect(checkout.getByText(/Pay at Pickup\./)).toBeVisible()
    await page.waitForTimeout(400)
    await audit(page, 'Checkout sheet (phone)')
    await checkout.getByRole('button', { name: 'Place local order request' }).click()

    await expect(page.getByRole('heading', { level: 1, name: /^Order CS-/ })).toBeVisible()
    await expect(page.getByText('Awaiting café acceptance').first()).toBeVisible()
    expect(await noOverflow(page)).toBe(false)
    await audit(page, 'Pending order tracker (phone)')
  })
})

test.describe('desktop journey', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('CH-AT-30: the whole order flow works from the keyboard', async ({ page }) => {
    await page.goto('/services/chill-spot')
    await expect(page.getByRole('heading', { level: 1, name: 'Chill Spot' })).toBeVisible()
    await page
      .getByRole('button', { name: /^Choose/ })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: /Add to cart/ }).focus()
    await page.keyboard.press('Enter')
    await expect(sheet).toBeHidden()

    await page.getByRole('button', { name: 'Review checkout' }).focus()
    await page.keyboard.press('Enter')
    const checkout = page.getByRole('dialog', { name: /Review your local order/ })
    await expect(checkout).toBeVisible()
    await checkout.getByRole('button', { name: 'Place local order request' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: /^Order CS-/ })).toBeVisible()
  })

  test('CH-AT-20/21/22: the simulator is off until Settings enables it; each step is a visible click and ready shows a ticket, never "paid"', async ({
    page,
  }) => {
    await page.goto('/services/chill-spot')
    await expect(page.getByTestId('demo-ops')).toHaveCount(0)
    await addFirstItem(page)
    await page.getByRole('button', { name: 'Review checkout' }).click()
    await page
      .getByRole('dialog', { name: /Review your local order/ })
      .getByRole('button', { name: 'Place local order request' })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: /^Order CS-/ })).toBeVisible()
    const orderUrl = page.url()

    // Nothing moves on its own.
    await page.waitForTimeout(1500)
    await expect(page.getByText('Awaiting café acceptance').first()).toBeVisible()

    await page.goto('/settings')
    await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
    await page.goto('/services/chill-spot')
    const ops = page.getByTestId('demo-ops')
    await expect(ops).toBeVisible()
    await audit(page, 'Local Operations panel')

    for (const step of [/^Accept/, /^Start preparing/, /^Mark ready/]) {
      await ops.getByRole('button', { name: step }).first().click()
    }
    await page.goto(orderUrl)
    await expect(page.getByText('Ready for pickup · Pay at café counter').first()).toBeVisible()
    await expect(page.getByText(/pickup code/i).first()).toBeVisible()
    await expect(page.getByText(/payment (received|confirmed)|\bpaid\b/i)).toHaveCount(0)
    await audit(page, 'Ready order tracker')

    await page.goto('/')
    const activity = page.getByRole('region', { name: 'My activity' })
    await expect(activity.getByText(/Chill Spot order CS-/)).toBeVisible()
    await expect(activity.getByText(/Ready for pickup/)).toBeVisible()
  })

  test('CH-AT-30: reduced-motion emulation removes transition and animation time', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/services/chill-spot')
    await page
      .getByRole('button', { name: /^Choose/ })
      .first()
      .click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    const timing = await sheet.evaluate((el) => {
      const s = getComputedStyle(el)
      return { transition: s.transitionDuration, animation: s.animationDuration }
    })
    for (const value of Object.values(timing))
      for (const part of value.split(',')) expect(parseFloat(part)).toBeLessThanOrEqual(0.001)
  })

  test('CH-AT-03: an empty search result says so', async ({ page }) => {
    await page.goto('/services/chill-spot')
    await page.getByRole('searchbox', { name: 'Search the menu' }).fill('zzzz-no-such-item')
    await expect(page.getByText(/No menu items match/)).toBeVisible()
  })

  test('CH-AT-29: Time Tax shows a signed result and a hypothetical, never observed, label', async ({
    page,
  }) => {
    await page.goto('/services/chill-spot')
    const tt = page.getByRole('region', { name: /Time Tax scenario/ })
    await expect(tt.getByText('Illustrative scenario, not an observation')).toBeVisible()
    await expect(tt.getByText(/−26 minutes/)).toBeVisible()
    await expect(tt.getByText(/None recorded/)).toBeVisible()
  })
})
