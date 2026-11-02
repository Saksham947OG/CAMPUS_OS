import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Chill Spot V2 (COS-CHILL-V2-001): step tracker, queue clocks, handling notes, arrival marker,
 * Operations view. Everything is a labelled demo; the simulated café is a local panel.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
async function audit(page: Page, label: string) {
  await page.waitForTimeout(500)
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    `${label}: axe violations`,
  ).toEqual([])
}
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

async function placeOrder(page: Page) {
  await page.goto('/services/chill-spot')
  await page
    .getByRole('button', { name: /^Choose/ })
    .first()
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Add to cart/ })
    .click()
  const viewCart = page.getByRole('button', { name: /View cart/ })
  const review = page.getByRole('button', { name: 'Review checkout' })
  await viewCart.or(review).first().waitFor()
  if (await viewCart.isVisible()) await viewCart.click()
  await page.getByRole('button', { name: 'Review checkout' }).click()
  await page.getByRole('button', { name: 'Place local order request' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Order CS-/ })).toBeVisible()
}

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`CH2-AT-29 Chill Spot pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await placeOrder(page)
    expect(await noOverflow(page), `tracker at ${width}px`).toBe(false)
    await page.goto('/services/chill-spot')
    await expect(page.getByRole('heading', { level: 1, name: 'Chill Spot' })).toBeVisible()
    expect(await noOverflow(page), `landing at ${width}px`).toBe(false)
  })
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })

  test('CH2-AT-29 / CH2-AT-16: a keyboard-only student places an order, marks arrival and sees the ticket only when ready (reduced motion)', async ({
    page,
  }) => {
    await placeOrder(page)
    await expect(page.getByTestId('step-bar')).toBeVisible()
    await expect(page.getByTestId('next-step')).toContainText('not a confirmed order')
    const arrive = page.getByRole('button', { name: 'I arrived at pickup' })
    await arrive.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(/self-reported, demo/)).toBeVisible()
    await expect(page.getByLabel('Pickup ticket')).toHaveCount(0)
    await audit(page, 'Order tracker')

    await page.goto('/settings')
    await page.getByRole('checkbox', { name: /Show Local Operations/ }).check()
    await page.goto('/services/chill-spot')
    const ops = page.getByTestId('demo-ops')
    await expect(ops).toBeVisible()
    await audit(page, 'Chill Spot operations lab')
    const row = ops.locator('[data-ops-order]').first()
    for (const label of ['Accept', 'Start preparing', 'Mark ready']) {
      await row.getByRole('button', { name: new RegExp(`^${label}`) }).click()
    }
    await page.getByRole('link', { name: 'Track order' }).first().click()
    await expect(page.getByLabel('Pickup ticket')).toBeVisible()
    await expect(page.getByText(/Collection point not provided/)).toBeVisible()
    await audit(page, 'Ready ticket')
  })

  test('CH2-AT-25 / CH2-AT-27: the three Time Tax views are axe-clean and the field view is empty', async ({
    page,
  }) => {
    await page.goto('/services/chill-spot')
    for (const tab of ['Scenario Lab', 'Operations view', 'Field observations']) {
      await page.getByRole('tab', { name: tab }).click()
      await audit(page, `Time Tax › ${tab}`)
    }
    await expect(page.getByTestId('field-empty')).toContainText('Nothing has been measured')
  })
})
